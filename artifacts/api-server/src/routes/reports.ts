import { Router, type IRouter } from "express";
import { db, eventsTable, revenueEntriesTable, attendeesTable, frfRecordsTable, donationsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

router.get("/reports/revenue-by-event", async (_req, res): Promise<void> => {
  const [events, revenueEntries] = await Promise.all([
    db.select().from(eventsTable),
    db.select().from(revenueEntriesTable),
  ]);

  const result = events.map(event => {
    const entries = revenueEntries.filter(r => r.eventId === event.id);
    const byType = {
      cash: 0,
      check: 0,
      online: 0,
      other: 0,
    };
    entries.forEach(r => {
      const amount = parseFloat(r.amount as string);
      if (r.paymentType === "cash") byType.cash += amount;
      else if (r.paymentType === "check" || r.paymentType === "mailed-check") byType.check += amount;
      else if (r.paymentType === "online") byType.online += amount;
      else byType.other += amount;
    });

    return {
      eventId: event.id,
      eventName: event.name,
      date: event.date,
      totalRevenue: Object.values(byType).reduce((sum, v) => sum + v, 0),
      cashAmount: byType.cash,
      checkAmount: byType.check,
      onlineAmount: byType.online,
      otherAmount: byType.other,
    };
  });

  result.sort((a, b) => b.totalRevenue - a.totalRevenue);
  res.json(result);
});

router.get("/reports/donor-conversion", async (_req, res): Promise<void> => {
  const [events, attendees, revenueEntries] = await Promise.all([
    db.select().from(eventsTable),
    db.select().from(attendeesTable),
    db.select().from(revenueEntriesTable),
  ]);

  const result = events.map(event => {
    const eventAttendees = attendees.filter(a => a.eventId === event.id && a.attended);
    const donors = attendees.filter(a => a.eventId === event.id && a.donated);
    const totalRaised = revenueEntries.filter(r => r.eventId === event.id).reduce((sum, r) => sum + parseFloat(r.amount as string), 0);

    return {
      eventId: event.id,
      eventName: event.name,
      eventType: event.eventType,
      totalAttendees: eventAttendees.length,
      attendeesDonated: donors.length,
      conversionRate: eventAttendees.length > 0 ? donors.length / eventAttendees.length : 0,
      totalRaised,
    };
  });

  result.sort((a, b) => b.conversionRate - a.conversionRate);
  res.json(result);
});

router.get("/reports/frf-status", async (_req, res): Promise<void> => {
  const [events, frfRecords, revenueEntries] = await Promise.all([
    db.select().from(eventsTable),
    db.select().from(frfRecordsTable),
    db.select().from(revenueEntriesTable),
  ]);

  const result = events.map(event => {
    const frf = frfRecords.find(f => f.eventId === event.id);
    const revenueTotal = revenueEntries.filter(r => r.eventId === event.id).reduce((sum, r) => sum + parseFloat(r.amount as string), 0);
    const frfTotal = frf ? parseFloat(frf.totalAmount as string) : 0;

    return {
      eventId: event.id,
      eventName: event.name,
      eventStatus: event.status,
      frfStatus: frf?.reconciliationStatus ?? null,
      revenueTotal,
      frfTotal,
      variance: frfTotal - revenueTotal,
    };
  });

  res.json(result);
});

router.get("/reports/cause-interest", async (_req, res): Promise<void> => {
  const donations = await db.select().from(donationsTable);

  const causeMap: Record<string, { totalDonated: number; donationCount: number; donors: Set<number> }> = {};

  donations.forEach(d => {
    const cause = d.cause || "Unspecified";
    if (!causeMap[cause]) {
      causeMap[cause] = { totalDonated: 0, donationCount: 0, donors: new Set() };
    }
    causeMap[cause].totalDonated += parseFloat(d.amount as string);
    causeMap[cause].donationCount++;
    causeMap[cause].donors.add(d.donorId);
  });

  const result = Object.entries(causeMap)
    .map(([cause, data]) => ({
      cause,
      totalDonated: data.totalDonated,
      donationCount: data.donationCount,
      uniqueDonors: data.donors.size,
    }))
    .sort((a, b) => b.totalDonated - a.totalDonated);

  res.json(result);
});

export default router;
