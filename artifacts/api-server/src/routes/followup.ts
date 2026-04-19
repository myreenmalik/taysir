import { Router, type IRouter } from "express";
import { eq, and, gt } from "drizzle-orm";
import { db, followUpTasksTable, attendeesTable, eventsTable, donorsTable, donationsTable, allocationsTable } from "@workspace/db";
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

// Compute the primary cause for an event:
//   1. Largest allocation by amount.
//   2. Fallback: dominant cause across donations for that event (by total amount).
//   3. Otherwise null.
function deriveEventPrimaryCause(
  allocations: typeof allocationsTable.$inferSelect[],
  donations: typeof donationsTable.$inferSelect[],
): string | null {
  if (allocations.length > 0) {
    const sorted = [...allocations].sort(
      (a, b) => parseFloat(b.amount as string) - parseFloat(a.amount as string),
    );
    const top = sorted[0];
    if (top?.category) return top.category;
  }
  const causeTotals: Record<string, number> = {};
  for (const d of donations) {
    if (d.cause) {
      causeTotals[d.cause] = (causeTotals[d.cause] ?? 0) + parseFloat(d.amount as string);
    }
  }
  const entries = Object.entries(causeTotals).sort(([, a], [, b]) => b - a);
  return entries[0]?.[0] ?? null;
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
  const allocations = await db.select().from(allocationsTable).where(eq(allocationsTable.eventId, params.data.id));
  const eventDonations = await db.select().from(donationsTable).where(eq(donationsTable.eventId, params.data.id));
  const primaryCause = deriveEventPrimaryCause(allocations, eventDonations);
  const causeSuffix = primaryCause ? ` — ${primaryCause}` : "";

  const dueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const attendedCount = attendees.filter(a => a.attended).length;
  const tasksToCreate = [
    {
      eventId: params.data.id,
      attendeeId: null,
      donorId: null,
      taskType: "submit-frf",
      recommendedAction: "Submit Fund Receipt Form for this event",
      status: "not-started",
      dueDate,
      notes: `FRF submission required for "${event.name}"${causeSuffix}`,
    },
    {
      eventId: params.data.id,
      attendeeId: null,
      donorId: null,
      taskType: "thank-you-email",
      recommendedAction: primaryCause
        ? `Send thank-you email referencing ${primaryCause} to all attendees`
        : "Send thank-you email to all attendees",
      status: "not-started",
      dueDate,
      notes: primaryCause
        ? `Send appreciation email to ${attendedCount} attendees from "${event.name}". Reference the event's focus on ${primaryCause}.`
        : `Send appreciation email to ${attendedCount} attendees from "${event.name}"`,
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
      recommendedAction: primaryCause
        ? `Send ${primaryCause} donation request to ${nonDonors.length} engaged non-donors`
        : `Send donation request to ${nonDonors.length} engaged non-donors`,
      status: "not-started",
      dueDate,
      notes: primaryCause
        ? `These attendees were engaged but did not donate at the event. Pitch our ${primaryCause} work, which this event focused on.`
        : "These attendees were engaged but did not donate at the event",
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
      notes: primaryCause
        ? `These attendees expressed interest in volunteering. Connect them with ${primaryCause} opportunities first.`
        : "These attendees expressed interest in volunteering",
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
//  - donation-ask (cause-aligned event invite): donor's top cause matches an upcoming event's primary cause; deduped per donor+event
router.post("/donors/generate-followups", async (_req, res): Promise<void> => {
  const donors = await db.select().from(donorsTable);
  const allDonations = await db.select().from(donationsTable);
  const allEvents = await db.select().from(eventsTable);
  const allAllocations = await db.select().from(allocationsTable);
  const allFollowUps = await db.select().from(followUpTasksTable);

  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const dueDate = new Date(now + 7 * day).toISOString().split("T")[0];
  const todayStr = new Date(now).toISOString().split("T")[0];

  // Group donations by donor
  const donationsByDonor = new Map<number, typeof donationsTable.$inferSelect[]>();
  for (const d of allDonations) {
    const list = donationsByDonor.get(d.donorId) ?? [];
    list.push(d);
    donationsByDonor.set(d.donorId, list);
  }

  // Group allocations and donations by event
  const allocationsByEvent = new Map<number, typeof allocationsTable.$inferSelect[]>();
  for (const a of allAllocations) {
    const list = allocationsByEvent.get(a.eventId) ?? [];
    list.push(a);
    allocationsByEvent.set(a.eventId, list);
  }
  const donationsByEvent = new Map<number, typeof donationsTable.$inferSelect[]>();
  for (const d of allDonations) {
    if (d.eventId == null) continue;
    const list = donationsByEvent.get(d.eventId) ?? [];
    list.push(d);
    donationsByEvent.set(d.eventId, list);
  }

  // Identify upcoming events (date >= today, not cancelled/completed/reconciled/closed) and their primary cause
  const upcomingEventsWithCause: Array<{ event: typeof eventsTable.$inferSelect; cause: string }> = [];
  for (const e of allEvents) {
    if (!e.date || e.date < todayStr) continue;
    const finished = ["completed", "cancelled", "canceled", "reconciled", "closed"];
    if (finished.includes(e.status)) continue;
    const cause = deriveEventPrimaryCause(
      allocationsByEvent.get(e.id) ?? [],
      donationsByEvent.get(e.id) ?? [],
    );
    if (cause) upcomingEventsWithCause.push({ event: e, cause });
  }

  const tasksToCreate: Array<typeof followUpTasksTable.$inferInsert> = [];

  for (const donor of donors) {
    const lastDonationMs = donor.lastDonationDate ? new Date(donor.lastDonationDate).getTime() : null;
    const ageDays = lastDonationMs != null ? Math.floor((now - lastDonationMs) / day) : null;

    // Existing tasks for this donor (used to dedupe)
    const existing = allFollowUps.filter(t => t.donorId === donor.id);
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

    // Compute donor's top cause(s) and most-recent-gift cause from donations
    const donorDonations = donationsByDonor.get(donor.id) ?? [];
    const causeTotals: Record<string, number> = {};
    for (const d of donorDonations) {
      if (d.cause) causeTotals[d.cause] = (causeTotals[d.cause] ?? 0) + parseFloat(d.amount as string);
    }
    const topCauses = Object.entries(causeTotals)
      .sort(([, a], [, b]) => b - a)
      .map(([c]) => c);
    const topCause = topCauses[0] ?? null;

    // Most-recent-gift cause: latest donation by date that has a cause
    const sortedByDate = [...donorDonations].sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
    const recentCause = sortedByDate.find(d => d.cause)?.cause ?? null;

    // 1) Thank-you for recent donation
    if (lastDonationMs != null && ageDays != null && ageDays <= 30 && !hasSinceLastDonation("thank-you-email")) {
      const causePhrase = recentCause
        ? `your recent gift to ${recentCause} on ${donor.lastDonationDate}`
        : `your recent gift on ${donor.lastDonationDate}`;
      const impactPhrase = recentCause
        ? `our ${recentCause} work, alongside the broader relief, education, and emergency response`
        : `the relief, education, and emergency response work`;
      tasksToCreate.push({
        eventId: null,
        attendeeId: null,
        donorId: donor.id,
        taskType: "thank-you-email",
        recommendedAction: recentCause
          ? `Send a thank-you to ${donor.name} for their recent ${recentCause} gift`
          : `Send a thank-you to ${donor.name} for their recent gift`,
        status: "not-started",
        dueDate,
        notes: `Last donation: ${donor.lastDonationDate}${recentCause ? ` to ${recentCause}` : ""} ($${donor.averageDonation} avg, $${donor.totalDonated} lifetime)`,
        suggestedMessage:
          `Dear ${firstName},\n\n` +
          `Thank you so much for ${causePhrase}. Your generosity ` +
          `directly supports the families and communities Islamic Relief USA serves every day.\n\n` +
          `Across your ${donor.donationCount} ${donor.donationCount === 1 ? "gift" : "gifts"} totaling ` +
          `$${donor.totalDonated}, you've helped fund ${impactPhrase} ` +
          `that defines our mission. We are truly grateful to have you with us.\n\n` +
          `With gratitude,\nThe Islamic Relief USA Team`,
      });
    }

    // 2) Re-engage lapsed donors
    if (donor.donorCategory === "lapsed" && !hasRecent("donation-ask", 90)) {
      const causeNote = topCause ? ` Top historical cause: ${topCause}.` : "";
      tasksToCreate.push({
        eventId: null,
        attendeeId: null,
        donorId: donor.id,
        taskType: "donation-ask",
        recommendedAction: topCause
          ? `Re-engage lapsed ${topCause} donor ${donor.name}`
          : `Re-engage lapsed donor ${donor.name}`,
        status: "not-started",
        dueDate,
        notes: `Lapsed donor — last donation ${donor.lastDonationDate ?? "unknown"}. Lifetime $${donor.totalDonated} across ${donor.donationCount} gifts.${causeNote}`,
        suggestedMessage:
          `Dear ${firstName},\n\n` +
          `It has been a while since we last heard from you${donor.lastDonationDate ? ` — your most recent gift was on ${donor.lastDonationDate}` : ""}, ` +
          `and we wanted to reach out personally. Your past support of $${donor.totalDonated} across ${donor.donationCount} ` +
          `${donor.donationCount === 1 ? "gift" : "gifts"} has had a lasting impact on the families we serve.\n\n` +
          (topCause
            ? `We remember your generosity especially around ${topCause}, and we'd love to share a recent update from that work ` +
              `and explore how you might re-engage there today. Even a small gift can help us continue this mission.\n\n`
            : `We'd love to share what's been happening since then and learn whether there's a cause close to your heart ` +
              `that we can connect you with today. Even a small gift can help us continue this work.\n\n`) +
          `With appreciation,\nThe Islamic Relief USA Team`,
      });
    }

    // 3) Stewardship call for major donors who've gone quiet
    if (donor.donorCategory === "major" && ageDays != null && ageDays > 90 && !hasRecent("stewardship-call", 90)) {
      const causeNote = topCause ? ` Top cause: ${topCause}.` : "";
      tasksToCreate.push({
        eventId: null,
        attendeeId: null,
        donorId: donor.id,
        taskType: "stewardship-call",
        recommendedAction: topCause
          ? `Stewardship check-in with major ${topCause} donor ${donor.name}`
          : `Stewardship check-in with major donor ${donor.name}`,
        status: "not-started",
        dueDate,
        notes: `Major donor — $${donor.totalDonated} lifetime, last donation ${ageDays} days ago.${causeNote}`,
        suggestedMessage:
          `Dear ${firstName},\n\n` +
          `As one of our most generous supporters — with $${donor.totalDonated} contributed across ${donor.donationCount} ` +
          `${donor.donationCount === 1 ? "gift" : "gifts"}${topCause ? `, much of it supporting ${topCause}` : ""} — your partnership means a great deal to all of us at Islamic Relief USA. ` +
          `It's been about ${ageDays} days since your last gift, and I wanted to reach out personally rather than send a routine update.\n\n` +
          (topCause
            ? `I'd welcome the chance for a brief call in the coming weeks to share where your ${topCause} support is making the biggest difference ` +
              `right now and to hear what matters most to you. Please let me know a time that works.\n\n`
            : `I'd welcome the chance for a brief call in the coming weeks to share where your support is making the biggest difference ` +
              `right now and to hear what matters most to you. Please let me know a time that works.\n\n`) +
          `With deep gratitude,\nThe Islamic Relief USA Team`,
      });
    }

    // 4) Upgrade ask for recurring donors who've slowed down
    if (donor.donorCategory === "recurring" && Number(donor.totalDonated) >= 1000 && ageDays != null && ageDays > 60 && !hasRecent("donation-ask", 90)) {
      const causeNote = topCause ? ` Top cause: ${topCause}.` : "";
      tasksToCreate.push({
        eventId: null,
        attendeeId: null,
        donorId: donor.id,
        taskType: "donation-ask",
        recommendedAction: topCause
          ? `Upgrade ask for recurring ${topCause} donor ${donor.name}`
          : `Upgrade ask for recurring donor ${donor.name}`,
        status: "not-started",
        dueDate,
        notes: `Recurring donor at $${donor.averageDonation} avg, ${donor.donationCount} gifts. Hasn't given in ${ageDays} days — invite them to step up.${causeNote}`,
        suggestedMessage:
          `Dear ${firstName},\n\n` +
          `Thank you for being one of our most consistent supporters — your ${donor.donationCount} gifts averaging ` +
          `$${donor.averageDonation} have added up to $${donor.totalDonated} of real, sustained impact` +
          `${topCause ? `, especially for our ${topCause} work` : ""}. ` +
          `It's been about ${ageDays} days since your last contribution, and we wanted to check in.\n\n` +
          (topCause
            ? `If you're in a position to step up your support of ${topCause}, even a modest increase to your usual gift would help us reach ` +
              `more families this season. Whatever you choose, we're grateful to have you on this journey with us.\n\n`
            : `If you're in a position to step up your support, even a modest increase to your usual gift would help us reach ` +
              `more families this season. Whatever you choose, we're grateful to have you on this journey with us.\n\n`) +
          `With gratitude,\nThe Islamic Relief USA Team`,
      });
    }

    // 5) Cause-aligned event invite: donor's top cause matches an upcoming event's primary cause.
    // Dedupe per donor + event so re-running doesn't pile up duplicates.
    if (topCause) {
      const matchedEvents = upcomingEventsWithCause.filter(
        ({ cause }) => cause.toLowerCase() === topCause.toLowerCase(),
      );
      for (const { event, cause } of matchedEvents) {
        const alreadyForEvent = existing.some(
          t => t.eventId === event.id && t.taskType === "donation-ask",
        );
        if (alreadyForEvent) continue;
        tasksToCreate.push({
          eventId: event.id,
          attendeeId: null,
          donorId: donor.id,
          taskType: "donation-ask",
          recommendedAction: `Invite ${donor.name} to ${event.name} (aligned with their ${cause} support)`,
          status: "not-started",
          dueDate,
          notes: `Cause-aligned invite — donor's top cause is ${cause}, which matches "${event.name}" on ${event.date}${event.location ? ` at ${event.location}` : ""}.`,
          suggestedMessage:
            `Dear ${firstName},\n\n` +
            `Because of your meaningful support for ${cause}, I wanted to personally invite you to an upcoming event ` +
            `that's centered on exactly that work: "${event.name}" on ${event.date}${event.location ? ` at ${event.location}` : ""}.\n\n` +
            `It would be wonderful to have you with us — whether to learn more about the impact your past gifts have made, ` +
            `to meet others who care about ${cause}, or to consider stepping up your support at the event.\n\n` +
            `Please let me know if you'd like to attend or if there's anything I can share ahead of time.\n\n` +
            `With gratitude,\nThe Islamic Relief USA Team`,
        });
      }
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
