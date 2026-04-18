import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, attendeesTable, donationsTable } from "@workspace/db";
import {
  ListAttendeesParams,
  CreateAttendeeParams,
  CreateAttendeeBody,
  UpdateAttendeeParams,
  UpdateAttendeeBody,
  DeleteAttendeeParams,
  GetAttendeeSegmentsParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

function serializeAttendee(a: typeof attendeesTable.$inferSelect) {
  return {
    ...a,
    donationAmount: a.donationAmount ? parseFloat(a.donationAmount as string) : null,
    createdAt: a.createdAt.toISOString(),
  };
}

router.get("/events/:eventId/attendees", async (req, res): Promise<void> => {
  const params = ListAttendeesParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const attendees = await db.select().from(attendeesTable).where(eq(attendeesTable.eventId, params.data.eventId));
  res.json(attendees.map(serializeAttendee));
});

router.post("/events/:eventId/attendees", async (req, res): Promise<void> => {
  const params = CreateAttendeeParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = CreateAttendeeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [attendee] = await db.insert(attendeesTable).values({
    eventId: params.data.eventId,
    name: parsed.data.name,
    email: parsed.data.email ?? null,
    phone: parsed.data.phone ?? null,
    attended: parsed.data.attended ?? true,
    donated: parsed.data.donated ?? false,
    donationAmount: parsed.data.donationAmount ? String(parsed.data.donationAmount) : null,
    volunteerInterest: parsed.data.volunteerInterest ?? false,
    attendeeType: parsed.data.attendeeType ?? "first-time",
    engagementLevel: parsed.data.engagementLevel ?? null,
    notes: parsed.data.notes ?? null,
    donorId: parsed.data.donorId ?? null,
  }).returning();

  res.status(201).json(serializeAttendee(attendee));
});

router.patch("/attendees/:id", async (req, res): Promise<void> => {
  const params = UpdateAttendeeParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateAttendeeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updateData: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
  if ("email" in parsed.data) updateData.email = parsed.data.email;
  if ("phone" in parsed.data) updateData.phone = parsed.data.phone;
  if (parsed.data.attended !== undefined) updateData.attended = parsed.data.attended;
  if (parsed.data.donated !== undefined) updateData.donated = parsed.data.donated;
  if ("donationAmount" in parsed.data) updateData.donationAmount = parsed.data.donationAmount ? String(parsed.data.donationAmount) : null;
  if (parsed.data.volunteerInterest !== undefined) updateData.volunteerInterest = parsed.data.volunteerInterest;
  if (parsed.data.attendeeType !== undefined) updateData.attendeeType = parsed.data.attendeeType;
  if ("engagementLevel" in parsed.data) updateData.engagementLevel = parsed.data.engagementLevel;
  if ("notes" in parsed.data) updateData.notes = parsed.data.notes;
  if ("donorId" in parsed.data) updateData.donorId = parsed.data.donorId;

  const [attendee] = await db.update(attendeesTable).set(updateData).where(eq(attendeesTable.id, params.data.id)).returning();
  if (!attendee) {
    res.status(404).json({ error: "Attendee not found" });
    return;
  }

  res.json(serializeAttendee(attendee));
});

router.delete("/attendees/:id", async (req, res): Promise<void> => {
  const params = DeleteAttendeeParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [attendee] = await db.delete(attendeesTable).where(eq(attendeesTable.id, params.data.id)).returning();
  if (!attendee) {
    res.status(404).json({ error: "Attendee not found" });
    return;
  }

  res.sendStatus(204);
});

router.get("/events/:eventId/attendee-segments", async (req, res): Promise<void> => {
  const params = GetAttendeeSegmentsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const attendees = await db.select().from(attendeesTable).where(eq(attendeesTable.eventId, params.data.eventId));
  const serialized = attendees.map(serializeAttendee);

  // Get high-value donors (donation amount >= 500)
  const highValueThreshold = 500;

  res.json({
    attendedNotDonated: serialized.filter(a => a.attended && !a.donated),
    attendedAndDonated: serialized.filter(a => a.attended && a.donated),
    firstTimeAttendees: serialized.filter(a => a.attendeeType === "first-time"),
    repeatAttendees: serialized.filter(a => a.attendeeType === "repeat"),
    volunteerInterested: serialized.filter(a => a.volunteerInterest),
    highValueDonorAttendees: serialized.filter(a => a.donated && a.donationAmount && a.donationAmount >= highValueThreshold),
  });
});

export default router;
