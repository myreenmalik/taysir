import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, followUpTasksTable, attendeesTable, eventsTable } from "@workspace/db";
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

export default router;
