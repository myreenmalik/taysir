import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { eventsTable, logisticsTasksTable, revenueEntriesTable, frfRecordsTable, allocationsTable, attendeesTable, followUpTasksTable } from "@workspace/db";
import {
  ListEventsQueryParams,
  CreateEventBody,
  GetEventParams,
  UpdateEventParams,
  UpdateEventBody,
  DeleteEventParams,
  GetEventSummaryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/events", async (req, res): Promise<void> => {
  const query = ListEventsQueryParams.safeParse(req.query);
  let events = await db.select().from(eventsTable).orderBy(eventsTable.date);

  if (query.success) {
    if (query.data.status) {
      events = events.filter(e => e.status === query.data.status);
    }
    if (query.data.eventType) {
      events = events.filter(e => e.eventType === query.data.eventType);
    }
    if (query.data.campaign) {
      events = events.filter(e => e.campaign === query.data.campaign);
    }
    if (query.data.location) {
      events = events.filter(e => e.location?.toLowerCase().includes(query.data.location!.toLowerCase()));
    }
  }

  res.json(events.map(e => ({
    ...e,
    estimatedAttendees: e.estimatedAttendees ?? null,
    actualAttendees: e.actualAttendees ?? null,
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
  })));
});

router.post("/events", async (req, res): Promise<void> => {
  const parsed = CreateEventBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [event] = await db.insert(eventsTable).values({
    name: parsed.data.name,
    date: parsed.data.date,
    location: parsed.data.location,
    masjidPartner: parsed.data.masjidPartner ?? null,
    eventType: parsed.data.eventType,
    campaign: parsed.data.campaign ?? null,
    organizer: parsed.data.organizer ?? null,
    status: parsed.data.status ?? "planned",
    estimatedAttendees: parsed.data.estimatedAttendees ?? null,
    actualAttendees: parsed.data.actualAttendees ?? null,
    notes: parsed.data.notes ?? null,
  }).returning();

  res.status(201).json({
    ...event,
    createdAt: event.createdAt.toISOString(),
    updatedAt: event.updatedAt.toISOString(),
  });
});

router.get("/events/:id", async (req, res): Promise<void> => {
  const params = GetEventParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [event] = await db.select().from(eventsTable).where(eq(eventsTable.id, params.data.id));
  if (!event) {
    res.status(404).json({ error: "Event not found" });
    return;
  }

  res.json({
    ...event,
    createdAt: event.createdAt.toISOString(),
    updatedAt: event.updatedAt.toISOString(),
  });
});

router.patch("/events/:id", async (req, res): Promise<void> => {
  const params = UpdateEventParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateEventBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updateData: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
  if (parsed.data.date !== undefined) updateData.date = parsed.data.date;
  if (parsed.data.location !== undefined) updateData.location = parsed.data.location;
  if ("masjidPartner" in parsed.data) updateData.masjidPartner = parsed.data.masjidPartner;
  if (parsed.data.eventType !== undefined) updateData.eventType = parsed.data.eventType;
  if ("campaign" in parsed.data) updateData.campaign = parsed.data.campaign;
  if ("organizer" in parsed.data) updateData.organizer = parsed.data.organizer;
  if (parsed.data.status !== undefined) updateData.status = parsed.data.status;
  if ("estimatedAttendees" in parsed.data) updateData.estimatedAttendees = parsed.data.estimatedAttendees;
  if ("actualAttendees" in parsed.data) updateData.actualAttendees = parsed.data.actualAttendees;
  if ("notes" in parsed.data) updateData.notes = parsed.data.notes;

  const [event] = await db.update(eventsTable).set(updateData).where(eq(eventsTable.id, params.data.id)).returning();
  if (!event) {
    res.status(404).json({ error: "Event not found" });
    return;
  }

  res.json({
    ...event,
    createdAt: event.createdAt.toISOString(),
    updatedAt: event.updatedAt.toISOString(),
  });
});

router.delete("/events/:id", async (req, res): Promise<void> => {
  const params = DeleteEventParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [event] = await db.delete(eventsTable).where(eq(eventsTable.id, params.data.id)).returning();
  if (!event) {
    res.status(404).json({ error: "Event not found" });
    return;
  }

  res.sendStatus(204);
});

router.get("/events/:id/summary", async (req, res): Promise<void> => {
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

  const [revenueRows, logisticsRows, attendeeRows, allocationRows, frfRow, followUpRows] = await Promise.all([
    db.select().from(revenueEntriesTable).where(eq(revenueEntriesTable.eventId, params.data.id)),
    db.select().from(logisticsTasksTable).where(eq(logisticsTasksTable.eventId, params.data.id)),
    db.select().from(attendeesTable).where(eq(attendeesTable.eventId, params.data.id)),
    db.select().from(allocationsTable).where(eq(allocationsTable.eventId, params.data.id)),
    db.select().from(frfRecordsTable).where(eq(frfRecordsTable.eventId, params.data.id)),
    db.select().from(followUpTasksTable).where(eq(followUpTasksTable.eventId, params.data.id)),
  ]);

  const totalRevenue = revenueRows.reduce((sum, r) => sum + parseFloat(r.amount as string), 0);
  const revenueByPaymentType: Record<string, number> = {};
  revenueRows.forEach(r => {
    revenueByPaymentType[r.paymentType] = (revenueByPaymentType[r.paymentType] || 0) + parseFloat(r.amount as string);
  });

  const totalAllocated = allocationRows.reduce((sum, a) => sum + parseFloat(a.amount as string), 0);
  const completedTasks = logisticsRows.filter(t => t.status === "completed").length;
  const logisticsCompletion = logisticsRows.length > 0 ? completedTasks / logisticsRows.length : 0;

  const donorAttendees = attendeeRows.filter(a => a.donated);
  const openFollowUps = followUpRows.filter(t => t.status !== "completed").length;

  res.json({
    event: {
      ...event,
      createdAt: event.createdAt.toISOString(),
      updatedAt: event.updatedAt.toISOString(),
    },
    totalRevenue,
    revenueByPaymentType,
    totalAllocated,
    allocationBalance: totalRevenue - totalAllocated,
    logisticsCompletion,
    attendeeCount: attendeeRows.filter(a => a.attended).length,
    donorAttendeeCount: donorAttendees.length,
    conversionRate: attendeeRows.length > 0 ? donorAttendees.length / attendeeRows.filter(a => a.attended).length : 0,
    frfStatus: frfRow[0]?.reconciliationStatus ?? null,
    openFollowUps,
  });
});

export default router;
