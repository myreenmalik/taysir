import { Router, type IRouter } from "express";
import { eq, ilike, or } from "drizzle-orm";
import { db, donorsTable, donationsTable, attendeesTable, eventsTable } from "@workspace/db";
import {
  ListDonorsQueryParams,
  CreateDonorBody,
  GetDonorParams,
  UpdateDonorParams,
  UpdateDonorBody,
  GetDonorProfileParams,
  GetDonorRecommendationsParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

function serializeDonor(d: typeof donorsTable.$inferSelect) {
  return {
    ...d,
    totalDonated: parseFloat(d.totalDonated as string),
    averageDonation: parseFloat(d.averageDonation as string),
    createdAt: d.createdAt.toISOString(),
    updatedAt: d.updatedAt.toISOString(),
  };
}

router.get("/donors", async (req, res): Promise<void> => {
  const query = ListDonorsQueryParams.safeParse(req.query);
  let donors = await db.select().from(donorsTable).orderBy(donorsTable.name);

  if (query.success) {
    if (query.data.donorCategory) {
      donors = donors.filter(d => d.donorCategory === query.data.donorCategory);
    }
    if (query.data.personalityType) {
      donors = donors.filter(d => d.donorPersonalityType === query.data.personalityType);
    }
    if (query.data.search) {
      const search = query.data.search.toLowerCase();
      donors = donors.filter(d =>
        d.name.toLowerCase().includes(search) ||
        d.email?.toLowerCase().includes(search) ||
        d.location?.toLowerCase().includes(search)
      );
    }
  }

  res.json(donors.map(serializeDonor));
});

router.post("/donors", async (req, res): Promise<void> => {
  const parsed = CreateDonorBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [donor] = await db.insert(donorsTable).values({
    name: parsed.data.name,
    email: parsed.data.email ?? null,
    phone: parsed.data.phone ?? null,
    location: parsed.data.location ?? null,
    donorCategory: parsed.data.donorCategory ?? "one-time",
    donorPersonalityType: parsed.data.donorPersonalityType ?? null,
    preferredContactFrequency: parsed.data.preferredContactFrequency ?? null,
    notes: parsed.data.notes ?? null,
  }).returning();

  res.status(201).json(serializeDonor(donor));
});

router.get("/donors/:id", async (req, res): Promise<void> => {
  const params = GetDonorParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [donor] = await db.select().from(donorsTable).where(eq(donorsTable.id, params.data.id));
  if (!donor) {
    res.status(404).json({ error: "Donor not found" });
    return;
  }

  res.json(serializeDonor(donor));
});

router.patch("/donors/:id", async (req, res): Promise<void> => {
  const params = UpdateDonorParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateDonorBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updateData: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
  if ("email" in parsed.data) updateData.email = parsed.data.email;
  if ("phone" in parsed.data) updateData.phone = parsed.data.phone;
  if ("location" in parsed.data) updateData.location = parsed.data.location;
  if (parsed.data.donorCategory !== undefined) updateData.donorCategory = parsed.data.donorCategory;
  if ("donorPersonalityType" in parsed.data) updateData.donorPersonalityType = parsed.data.donorPersonalityType;
  if ("preferredContactFrequency" in parsed.data) updateData.preferredContactFrequency = parsed.data.preferredContactFrequency;
  if ("notes" in parsed.data) updateData.notes = parsed.data.notes;

  const [donor] = await db.update(donorsTable).set(updateData).where(eq(donorsTable.id, params.data.id)).returning();
  if (!donor) {
    res.status(404).json({ error: "Donor not found" });
    return;
  }

  res.json(serializeDonor(donor));
});

router.get("/donors/:id/profile", async (req, res): Promise<void> => {
  const params = GetDonorProfileParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [donor] = await db.select().from(donorsTable).where(eq(donorsTable.id, params.data.id));
  if (!donor) {
    res.status(404).json({ error: "Donor not found" });
    return;
  }

  const [donations, attendeeRows] = await Promise.all([
    db.select().from(donationsTable).where(eq(donationsTable.donorId, params.data.id)),
    db.select().from(attendeesTable).where(eq(attendeesTable.donorId, params.data.id)),
  ]);

  // Get unique event IDs from both donations and attendees
  const eventIds = Array.from(new Set([
    ...donations.filter(d => d.eventId).map(d => d.eventId!),
    ...attendeeRows.map(a => a.eventId),
  ]));

  let eventsAttended: typeof eventsTable.$inferSelect[] = [];
  if (eventIds.length > 0) {
    eventsAttended = await db.select().from(eventsTable).where(
      eq(eventsTable.id, eventIds[0])
    );
    // For multiple event IDs, fetch all
    if (eventIds.length > 1) {
      const allEvents = await db.select().from(eventsTable);
      eventsAttended = allEvents.filter(e => eventIds.includes(e.id));
    }
  }

  // Compute top causes
  const causeCounts: Record<string, number> = {};
  donations.forEach(d => {
    if (d.cause) {
      causeCounts[d.cause] = (causeCounts[d.cause] || 0) + parseFloat(d.amount as string);
    }
  });
  const topCauses = Object.entries(causeCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([cause]) => cause);

  // Check if Ramadan giver
  const isRamadanGiver = donations.some(d => d.season?.toLowerCase().includes("ramadan"));

  // Check if emergency responder
  const isEmergencyResponder = donations.some(d =>
    d.cause?.toLowerCase().includes("emergency") ||
    d.campaign?.toLowerCase().includes("emergency")
  );

  // Compute scores (0-100)
  const totalDonated = parseFloat(donor.totalDonated as string);
  const daysSinceLast = donor.lastDonationDate
    ? Math.floor((Date.now() - new Date(donor.lastDonationDate).getTime()) / (1000 * 60 * 60 * 24))
    : 9999;
  const recencyScore = Math.max(0, 100 - daysSinceLast / 3.65);
  const givingFrequencyScore = Math.min(100, donor.donationCount * 10);
  const engagementRiskScore = daysSinceLast > 365 ? 80 : daysSinceLast > 180 ? 50 : 20;

  // Generate smart recommendations
  const recommendations = generateRecommendations(donor, donations, daysSinceLast, isRamadanGiver, topCauses);

  res.json({
    donor: serializeDonor(donor),
    donations: donations.map(d => ({
      ...d,
      amount: parseFloat(d.amount as string),
      createdAt: d.createdAt.toISOString(),
    })),
    eventsAttended: eventsAttended.map(e => ({
      ...e,
      createdAt: e.createdAt.toISOString(),
      updatedAt: e.updatedAt.toISOString(),
    })),
    topCauses,
    isRamadanGiver,
    isEmergencyResponder,
    givingFrequencyScore,
    recencyScore,
    engagementRiskScore,
    recommendations,
  });
});

function generateRecommendations(
  donor: typeof donorsTable.$inferSelect,
  donations: typeof donationsTable.$inferSelect[],
  daysSinceLast: number,
  isRamadanGiver: boolean,
  topCauses: string[]
): Array<{ id: number; action: string; reason: string; urgency: string; tone: string; suggestedSubject: string | null; suggestedMessage: string | null }> {
  const recs: Array<{ id: number; action: string; reason: string; urgency: string; tone: string; suggestedSubject: string | null; suggestedMessage: string | null }> = [];
  const category = donor.donorCategory;
  const personality = donor.donorPersonalityType;
  let id = 1;

  // Lapsed donor
  if (daysSinceLast > 365 || category === "lapsed") {
    recs.push({
      id: id++,
      action: "Re-engagement outreach",
      reason: "This donor has not given in over a year and may need personal attention to re-engage.",
      urgency: "high",
      tone: personality === "Altruist" ? "emotional" : personality === "Investor" ? "impact-driven" : "grateful",
      suggestedSubject: "We miss you — and so do the families you've helped",
      suggestedMessage: `Dear ${donor.name}, it's been a while since we've connected. Your past generosity has made a real difference. We'd love to share some updates and see if there's a cause that resonates with you today.`,
    });
  }

  // Cause-specific follow-up
  if (topCauses.length > 0) {
    const topCause = topCauses[0];
    recs.push({
      id: id++,
      action: `Send impact update for ${topCause}`,
      reason: `This donor has given most to ${topCause}. Sharing a specific impact story will resonate deeply.`,
      urgency: "medium",
      tone: personality === "Investor" ? "data-driven" : "storytelling",
      suggestedSubject: `See the difference your ${topCause} contribution made`,
      suggestedMessage: `Your support of ${topCause} has helped change lives. Here's a brief update on how your donation was used...`,
    });
  }

  // High frequency donor - more asks
  if (donor.donationCount >= 5 || category === "recurring") {
    recs.push({
      id: id++,
      action: "Send targeted campaign ask",
      reason: "Frequent donors respond well to specific, timely donation requests.",
      urgency: "medium",
      tone: "direct",
      suggestedSubject: "You've made this possible — one more step?",
      suggestedMessage: null,
    });
  }

  // One-time donor - nurture
  if (donor.donationCount === 1 || category === "one-time") {
    recs.push({
      id: id++,
      action: "Send thank-you + impact follow-up",
      reason: "First-time donors who receive a meaningful follow-up are 3x more likely to give again.",
      urgency: "high",
      tone: personality === "Repayer" ? "grateful" : "warm",
      suggestedSubject: "Thank you for your generosity — here's what happened next",
      suggestedMessage: `Dear ${donor.name}, your first gift made a real difference. We wanted to make sure you knew exactly how it was used...`,
    });
  }

  // Not Ramadan giver
  if (!isRamadanGiver) {
    recs.push({
      id: id++,
      action: "Deprioritize Ramadan campaigns",
      reason: "This donor has not historically given during Ramadan. Focus outreach on other seasons.",
      urgency: "low",
      tone: "informational",
      suggestedSubject: null,
      suggestedMessage: null,
    });
  }

  // Major donor stewardship
  if (category === "major") {
    recs.push({
      id: id++,
      action: "Personal major donor stewardship call",
      reason: "Major donors deserve personalized attention and relationship-building beyond email.",
      urgency: "high",
      tone: "personal",
      suggestedSubject: "An invitation to connect",
      suggestedMessage: null,
    });
  }

  return recs.slice(0, 5);
}

router.get("/donors/:id/recommendations", async (req, res): Promise<void> => {
  const params = GetDonorRecommendationsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [donor] = await db.select().from(donorsTable).where(eq(donorsTable.id, params.data.id));
  if (!donor) {
    res.status(404).json({ error: "Donor not found" });
    return;
  }

  const donations = await db.select().from(donationsTable).where(eq(donationsTable.donorId, params.data.id));

  const causeCounts: Record<string, number> = {};
  donations.forEach(d => {
    if (d.cause) causeCounts[d.cause] = (causeCounts[d.cause] || 0) + parseFloat(d.amount as string);
  });
  const topCauses = Object.entries(causeCounts).sort(([, a], [, b]) => b - a).slice(0, 5).map(([c]) => c);
  const daysSinceLast = donor.lastDonationDate ? Math.floor((Date.now() - new Date(donor.lastDonationDate).getTime()) / (1000 * 60 * 60 * 24)) : 9999;
  const isRamadanGiver = donations.some(d => d.season?.toLowerCase().includes("ramadan"));

  const recs = generateRecommendations(donor, donations, daysSinceLast, isRamadanGiver, topCauses);
  res.json(recs);
});

export default router;
