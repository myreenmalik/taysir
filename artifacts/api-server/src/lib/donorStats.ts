import { eq } from "drizzle-orm";
import { db, donationsTable, donorsTable } from "@workspace/db";

export type DonorTier = "Bronze" | "Silver" | "Gold" | "Platinum";
export type DonorPersonality = "Altruist" | "Investor" | "Repayer";

export function computeDonorTier(totalDonated: number, donationCount: number): DonorTier {
  if (totalDonated >= 10000) return "Platinum";
  if (totalDonated >= 5000) return "Gold";
  if (totalDonated >= 1000) return "Silver";
  if (donationCount >= 10 && totalDonated >= 500) return "Silver";
  return "Bronze";
}

type DonationRow = {
  amount: string;
  date: string;
  cause: string | null;
  campaign: string | null;
  season: string | null;
  donationType: string;
  eventId: number | null;
};

export function computeDonorPersonality(
  donations: DonationRow[],
  totalDonated: number,
  averageDonation: number,
  donationCount: number,
  donorCategory: string,
): DonorPersonality | null {
  if (donationCount === 0) return null;

  if (donorCategory === "major" || averageDonation >= 1000) return "Investor";

  const uniqueCauses = new Set(
    donations.map(d => (d.cause ?? "").trim().toLowerCase()).filter(c => c),
  );
  if (donationCount >= 5 && uniqueCauses.size >= 3) return "Altruist";

  const seasonalOrEvent = donations.filter(
    d => (d.season && d.season.trim()) || d.eventId != null,
  ).length;
  if (donationCount >= 2 && seasonalOrEvent / donationCount >= 0.5) return "Repayer";

  if (donationCount >= 5) return "Altruist";
  return "Repayer";
}

export type DonorStatsResult = {
  totalDonated: number;
  averageDonation: number;
  donationCount: number;
  firstDonationDate: string | null;
  lastDonationDate: string | null;
  donorCategory: string;
  donorTier: DonorTier;
  donorPersonalityType: DonorPersonality | null;
};

export async function recomputeDonorStats(donorId: number): Promise<DonorStatsResult | null> {
  const donations = await db.select().from(donationsTable).where(eq(donationsTable.donorId, donorId));
  const total = donations.reduce((sum, d) => sum + parseFloat(d.amount as string), 0);
  const avg = donations.length > 0 ? total / donations.length : 0;
  const sorted = [...donations].sort((a, b) => a.date.localeCompare(b.date));

  let donorCategory = "one-time";
  if (donations.length >= 5) donorCategory = "recurring";
  else if (donations.length >= 2) donorCategory = "seasonal";
  if (total >= 5000) donorCategory = "major";

  const lastDate = sorted[sorted.length - 1]?.date ?? null;
  if (lastDate && new Date(lastDate) < new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)) {
    donorCategory = "lapsed";
  }

  const tier = computeDonorTier(total, donations.length);
  const personality = computeDonorPersonality(
    donations.map(d => ({
      amount: d.amount as string,
      date: d.date,
      cause: d.cause,
      campaign: d.campaign,
      season: d.season,
      donationType: d.donationType,
      eventId: d.eventId,
    })),
    total,
    avg,
    donations.length,
    donorCategory,
  );

  await db.update(donorsTable).set({
    totalDonated: String(total),
    averageDonation: String(avg),
    donationCount: donations.length,
    firstDonationDate: sorted[0]?.date ?? null,
    lastDonationDate: lastDate,
    donorCategory,
    donorTier: tier,
    donorPersonalityType: personality,
  }).where(eq(donorsTable.id, donorId));

  return {
    totalDonated: total,
    averageDonation: avg,
    donationCount: donations.length,
    firstDonationDate: sorted[0]?.date ?? null,
    lastDonationDate: lastDate,
    donorCategory,
    donorTier: tier,
    donorPersonalityType: personality,
  };
}
