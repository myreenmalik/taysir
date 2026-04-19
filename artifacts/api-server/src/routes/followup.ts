import { Router, type IRouter } from "express";
import { eq, and, gt } from "drizzle-orm";
import { db, followUpTasksTable, attendeesTable, eventsTable, donorsTable } from "@workspace/db";
import {
  ListFollowUpTasksQueryParams,
  CreateFollowUpTaskBody,
  UpdateFollowUpTaskParams,
  UpdateFollowUpTaskBody,
  GetEventSummaryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

function serializeTask(t: typeof followUpTasksTable.$inferSelect) {
  return { ...t, createdAt: t.createdAt.toISOString() };
}

router.get("/follow-up-tasks", async (req, res): Promise<void> => {
  const query = ListFollowUpTasksQueryParams.safeParse(req.query);
  let tasks = await db.select().from(followUpTasksTable).orderBy(followUpTasksTable.createdAt);

  if (query.success) {
    if (query.data.eventId) {
      tasks = tasks.filter(t => t.eventId === Number(query.data.eventId));
    }
    if (query.data.donorId) {
      tasks = tasks.filter(t => t.donorId === Number(query.data.donorId));
    }
    if (query.data.status) {
      tasks = tasks.filter(t => t.status === query.data.status);
    }
  }

  res.json(tasks.map(serializeTask));
});

router.post("/follow-up-tasks", async (req, res): Promise<void> => {
  const parsed = CreateFollowUpTaskBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [task] = await db.insert(followUpTasksTable).values({
    eventId: parsed.data.eventId ?? null,
    attendeeId: parsed.data.attendeeId ?? null,
    donorId: parsed.data.donorId ?? null,
    taskType: parsed.data.taskType,
    recommendedAction: parsed.data.recommendedAction,
    status: parsed.data.status ?? "not-started",
    dueDate: parsed.data.dueDate ?? null,
    notes: parsed.data.notes ?? null,
    suggestedMessage: parsed.data.suggestedMessage ?? null,
  }).returning();

  res.status(201).json(serializeTask(task));
});

router.patch("/follow-up-tasks/:id", async (req, res): Promise<void> => {
  const params = UpdateFollowUpTaskParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateFollowUpTaskBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updateData: Record<string, unknown> = {};
  if (parsed.data.taskType !== undefined) updateData.taskType = parsed.data.taskType;
  if (parsed.data.recommendedAction !== undefined) updateData.recommendedAction = parsed.data.recommendedAction;
  if (parsed.data.status !== undefined) updateData.status = parsed.data.status;
  if ("dueDate" in parsed.data) updateData.dueDate = parsed.data.dueDate;
  if ("notes" in parsed.data) updateData.notes = parsed.data.notes;
  if ("suggestedMessage" in parsed.data) updateData.suggestedMessage = parsed.data.suggestedMessage;

  const [task] = await db.update(followUpTasksTable).set(updateData).where(eq(followUpTasksTable.id, params.data.id)).returning();
  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  res.json(serializeTask(task));
});

router.post("/events/:eventId/generate-followups", async (req, res): Promise<void> => {
  const params = GetEventSummaryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [event] = await db.select().from(eventsTable).where(eq(eventsTable.id, params.data.id));
  if (!event) {
    res.status(404).json({ error: "Event not found" });
    return;
  }

  const attendees = await db.select().from(attendeesTable).where(eq(attendeesTable.eventId, params.data.id));

  const dueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const tasksToCreate = [
    {
      eventId: params.data.id,
      attendeeId: null,
      donorId: null,
      taskType: "submit-frf",
      recommendedAction: "Submit Fund Receipt Form for this event",
      status: "not-started",
      dueDate,
      notes: `FRF submission required for "${event.name}"`,
    },
    {
      eventId: params.data.id,
      attendeeId: null,
      donorId: null,
      taskType: "thank-you-email",
      recommendedAction: "Send thank-you email to all attendees",
      status: "not-started",
      dueDate,
      notes: `Send appreciation email to ${attendees.filter(a => a.attended).length} attendees from "${event.name}"`,
    },
  ];

  // Add tasks for non-donors
  const nonDonors = attendees.filter(a => a.attended && !a.donated);
  if (nonDonors.length > 0) {
    tasksToCreate.push({
      eventId: params.data.id,
      attendeeId: null,
      donorId: null,
      taskType: "donation-ask",
      recommendedAction: `Send donation request to ${nonDonors.length} engaged non-donors`,
      status: "not-started",
      dueDate,
      notes: "These attendees were engaged but did not donate at the event",
    });
  }

  // Add task for volunteer-interested attendees
  const volunteerInterested = attendees.filter(a => a.volunteerInterest);
  if (volunteerInterested.length > 0) {
    tasksToCreate.push({
      eventId: params.data.id,
      attendeeId: null,
      donorId: null,
      taskType: "volunteer-invite",
      recommendedAction: `Follow up with ${volunteerInterested.length} volunteer-interested attendees`,
      status: "not-started",
      dueDate,
      notes: "These attendees expressed interest in volunteering",
    });
  }

  const tasks = await db.insert(followUpTasksTable).values(tasksToCreate).returning();
  res.json(tasks.map(serializeTask));
});

// Auto-generate per-donor follow-up tasks based on donor signals.
// Rules (all idempotent — won't double-create within their dedupe window):
//  - thank-you-email: donor donated within last 30 days, no thank-you task created since their last donation
//  - donation-ask (re-engagement): donorCategory == "lapsed", no donation-ask in last 90 days
//  - stewardship-call: donorCategory == "major" AND lastDonationDate older than 90 days, no stewardship in last 90 days
//  - donation-ask (upgrade): donorCategory == "recurring" AND totalDonated >= 1000 AND lastDonation older than 60 days, no donation-ask in last 90 days
router.post("/donors/generate-followups", async (_req, res): Promise<void> => {
  const donors = await db.select().from(donorsTable);
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const dueDate = new Date(now + 7 * day).toISOString().split("T")[0];

  const tasksToCreate: Array<typeof followUpTasksTable.$inferInsert> = [];

  for (const donor of donors) {
    const lastDonationMs = donor.lastDonationDate ? new Date(donor.lastDonationDate).getTime() : null;
    const ageDays = lastDonationMs != null ? Math.floor((now - lastDonationMs) / day) : null;

    // Existing tasks for this donor (used to dedupe)
    const existing = await db.select().from(followUpTasksTable).where(eq(followUpTasksTable.donorId, donor.id));
    const hasRecent = (taskType: string, withinDays: number) => existing.some(t => {
      if (t.taskType !== taskType) return false;
      const created = t.createdAt.getTime();
      return (now - created) <= withinDays * day;
    });
    const hasSinceLastDonation = (taskType: string) => {
      if (lastDonationMs == null) return false;
      return existing.some(t => t.taskType === taskType && t.createdAt.getTime() >= lastDonationMs);
    };

    const firstName = donor.name.split(/\s+/)[0] || donor.name;

    // 1) Thank-you for recent donation
    if (lastDonationMs != null && ageDays != null && ageDays <= 30 && !hasSinceLastDonation("thank-you-email")) {
      tasksToCreate.push({
        eventId: null,
        attendeeId: null,
        donorId: donor.id,
        taskType: "thank-you-email",
        recommendedAction: `Send a thank-you to ${donor.name} for their recent gift`,
        status: "not-started",
        dueDate,
        notes: `Last donation: ${donor.lastDonationDate} ($${donor.averageDonation} avg, $${donor.totalDonated} lifetime)`,
        suggestedMessage:
          `Dear ${firstName},\n\n` +
          `Thank you so much for your recent gift on ${donor.lastDonationDate}. Your generosity ` +
          `directly supports the families and communities Islamic Relief USA serves every day.\n\n` +
          `Across your ${donor.donationCount} ${donor.donationCount === 1 ? "gift" : "gifts"} totaling ` +
          `$${donor.totalDonated}, you've helped fund the relief, education, and emergency response work ` +
          `that defines our mission. We are truly grateful to have you with us.\n\n` +
          `With gratitude,\nThe Islamic Relief USA Team`,
      });
    }

    // 2) Re-engage lapsed donors
    if (donor.donorCategory === "lapsed" && !hasRecent("donation-ask", 90)) {
      tasksToCreate.push({
        eventId: null,
        attendeeId: null,
        donorId: donor.id,
        taskType: "donation-ask",
        recommendedAction: `Re-engage lapsed donor ${donor.name}`,
        status: "not-started",
        dueDate,
        notes: `Lapsed donor — last donation ${donor.lastDonationDate ?? "unknown"}. Lifetime $${donor.totalDonated} across ${donor.donationCount} gifts.`,
        suggestedMessage:
          `Dear ${firstName},\n\n` +
          `It has been a while since we last heard from you${donor.lastDonationDate ? ` — your most recent gift was on ${donor.lastDonationDate}` : ""}, ` +
          `and we wanted to reach out personally. Your past support of $${donor.totalDonated} across ${donor.donationCount} ` +
          `${donor.donationCount === 1 ? "gift" : "gifts"} has had a lasting impact on the families we serve.\n\n` +
          `We'd love to share what's been happening since then and learn whether there's a cause close to your heart ` +
          `that we can connect you with today. Even a small gift can help us continue this work.\n\n` +
          `With appreciation,\nThe Islamic Relief USA Team`,
      });
    }

    // 3) Stewardship call for major donors who've gone quiet
    if (donor.donorCategory === "major" && ageDays != null && ageDays > 90 && !hasRecent("stewardship-call", 90)) {
      tasksToCreate.push({
        eventId: null,
        attendeeId: null,
        donorId: donor.id,
        taskType: "stewardship-call",
        recommendedAction: `Stewardship check-in with major donor ${donor.name}`,
        status: "not-started",
        dueDate,
        notes: `Major donor — $${donor.totalDonated} lifetime, last donation ${ageDays} days ago.`,
        suggestedMessage:
          `Dear ${firstName},\n\n` +
          `As one of our most generous supporters — with $${donor.totalDonated} contributed across ${donor.donationCount} ` +
          `${donor.donationCount === 1 ? "gift" : "gifts"} — your partnership means a great deal to all of us at Islamic Relief USA. ` +
          `It's been about ${ageDays} days since your last gift, and I wanted to reach out personally rather than send a routine update.\n\n` +
          `I'd welcome the chance for a brief call in the coming weeks to share where your support is making the biggest difference ` +
          `right now and to hear what matters most to you. Please let me know a time that works.\n\n` +
          `With deep gratitude,\nThe Islamic Relief USA Team`,
      });
    }

    // 4) Upgrade ask for recurring donors who've slowed down
    if (donor.donorCategory === "recurring" && Number(donor.totalDonated) >= 1000 && ageDays != null && ageDays > 60 && !hasRecent("donation-ask", 90)) {
      tasksToCreate.push({
        eventId: null,
        attendeeId: null,
        donorId: donor.id,
        taskType: "donation-ask",
        recommendedAction: `Upgrade ask for recurring donor ${donor.name}`,
        status: "not-started",
        dueDate,
        notes: `Recurring donor at $${donor.averageDonation} avg, ${donor.donationCount} gifts. Hasn't given in ${ageDays} days — invite them to step up.`,
        suggestedMessage:
          `Dear ${firstName},\n\n` +
          `Thank you for being one of our most consistent supporters — your ${donor.donationCount} gifts averaging ` +
          `$${donor.averageDonation} have added up to $${donor.totalDonated} of real, sustained impact. ` +
          `It's been about ${ageDays} days since your last contribution, and we wanted to check in.\n\n` +
          `If you're in a position to step up your support, even a modest increase to your usual gift would help us reach ` +
          `more families this season. Whatever you choose, we're grateful to have you on this journey with us.\n\n` +
          `With gratitude,\nThe Islamic Relief USA Team`,
      });
    }
  }

  if (tasksToCreate.length === 0) {
    res.json({ created: 0, byType: {}, tasks: [] });
    return;
  }

  const created = await db.insert(followUpTasksTable).values(tasksToCreate).returning();
  const byType: Record<string, number> = {};
  for (const t of created) byType[t.taskType] = (byType[t.taskType] ?? 0) + 1;

  res.json({ created: created.length, byType, tasks: created.map(serializeTask) });
});

// Suppress unused imports if helper is added later
void and; void gt;

export default router;
