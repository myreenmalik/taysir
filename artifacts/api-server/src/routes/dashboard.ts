import { Router, type IRouter } from "express";
import { db, eventsTable, frfRecordsTable, attendeesTable, donorsTable, donationsTable, revenueEntriesTable, logisticsTasksTable, followUpTasksTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/dashboard/summary", async (_req, res): Promise<void> => {
  const [events, donors, donations, revenueEntries, frfRecords, logisticsTasks, followUpTasks, attendees] = await Promise.all([
    db.select().from(eventsTable),
    db.select().from(donorsTable),
    db.select().from(donationsTable),
    db.select().from(revenueEntriesTable),
    db.select().from(frfRecordsTable),
    db.select().from(logisticsTasksTable),
    db.select().from(followUpTasksTable),
    db.select().from(attendeesTable),
  ]);

  const today = new Date();
  const upcomingEvents = events.filter(e => new Date(e.date) > today && e.status !== "closed");
  const completedEvents = events.filter(e => e.status === "completed" || e.status === "reconciled" || e.status === "closed");

  // Completed events missing FRF
  const completedEventIds = completedEvents.map(e => e.id);
  const frfEventIds = new Set(frfRecords.map(f => f.eventId));
  const unreconciledFRFs = completedEvents.filter(e => !frfEventIds.has(e.id)).length;

  // Events missing attendance data
  const missingAttendanceData = completedEvents.filter(e =>
    !attendees.some(a => a.eventId === e.id)
  ).length;

  // Events with incomplete logistics (has tasks but not all completed)
  const incompleteLogistics = events.filter(e => {
    const tasks = logisticsTasks.filter(t => t.eventId === e.id);
    return tasks.length > 0 && tasks.some(t => t.status !== "completed");
  }).length;

  const pendingFollowUps = followUpTasks.filter(t => t.status !== "completed").length;
  const totalRevenue = revenueEntries.reduce((sum, r) => sum + parseFloat(r.amount as string), 0);
  const totalDonations = donations.reduce((sum, d) => sum + parseFloat(d.amount as string), 0);
  const totalAttendees = attendees.filter(a => a.attended).length;

  // At risk donors (lapsed)
  const atRiskDonors = donors.filter(d => d.donorCategory === "lapsed").length;

  // Tier breakdown
  const tiers = ["Bronze", "Silver", "Gold", "Platinum"] as const;
  const tierBreakdown = tiers.map(tier => {
    const tierDonors = donors.filter(d => d.donorTier === tier);
    const donorIds = new Set(tierDonors.map(d => d.id));
    const totalRaised = donations
      .filter(d => d.donorId !== null && donorIds.has(d.donorId))
      .reduce((sum, d) => sum + parseFloat(d.amount as string), 0);
    return { tier, donorCount: tierDonors.length, totalRaised };
  });

  res.json({
    totalEvents: events.length,
    upcomingEvents: upcomingEvents.length,
    completedEvents: completedEvents.length,
    totalRevenue,
    totalAttendees,
    totalDonors: donors.length,
    unreconciledFRFs,
    missingAttendanceData,
    incompleteLogistics,
    pendingFollowUps,
    totalDonations,
    atRiskDonors,
    tierBreakdown,
  });
});

router.get("/dashboard/alerts", async (_req, res): Promise<void> => {
  const [events, frfRecords, attendees, logisticsTasks, followUpTasks, donors, revenueEntries] = await Promise.all([
    db.select().from(eventsTable),
    db.select().from(frfRecordsTable),
    db.select().from(attendeesTable),
    db.select().from(logisticsTasksTable),
    db.select().from(followUpTasksTable),
    db.select().from(donorsTable),
    db.select().from(revenueEntriesTable),
  ]);

  const alerts: Array<{
    id: number;
    type: string;
    severity: string;
    message: string;
    eventId: number | null;
    donorId: number | null;
    entityName: string | null;
  }> = [];
  let alertId = 1;

  // Completed events missing FRF
  const frfEventIds = new Set(frfRecords.map(f => f.eventId));
  const completedEvents = events.filter(e => e.status === "completed" || e.status === "reconciled");
  completedEvents.forEach(event => {
    if (!frfEventIds.has(event.id)) {
      alerts.push({
        id: alertId++,
        type: "missing-frf",
        severity: "critical",
        message: `FRF not submitted for completed event: "${event.name}"`,
        eventId: event.id,
        donorId: null,
        entityName: event.name,
      });
    }
  });

  // FRF mismatches
  frfRecords.filter(f => f.reconciliationStatus === "mismatch").forEach(frf => {
    const event = events.find(e => e.id === frf.eventId);
    const revenueTotal = revenueEntries.filter(r => r.eventId === frf.eventId).reduce((sum, r) => sum + parseFloat(r.amount as string), 0);
    const frfTotal = parseFloat(frf.totalAmount as string);
    alerts.push({
      id: alertId++,
      type: "frf-mismatch",
      severity: "critical",
      message: `FRF total ($${frfTotal.toFixed(2)}) doesn't match recorded revenue ($${revenueTotal.toFixed(2)}) for "${event?.name}"`,
      eventId: frf.eventId,
      donorId: null,
      entityName: event?.name ?? null,
    });
  });

  // Missing attendance data
  completedEvents.forEach(event => {
    if (!attendees.some(a => a.eventId === event.id)) {
      alerts.push({
        id: alertId++,
        type: "missing-attendance",
        severity: "warning",
        message: `No attendance logged for completed event: "${event.name}"`,
        eventId: event.id,
        donorId: null,
        entityName: event.name,
      });
    }
  });

  // Lapsed donors
  const lapsedDonors = donors.filter(d => d.donorCategory === "lapsed").slice(0, 3);
  lapsedDonors.forEach(donor => {
    alerts.push({
      id: alertId++,
      type: "lapsed-donor",
      severity: "warning",
      message: `Lapsed donor may need re-engagement: ${donor.name}`,
      eventId: null,
      donorId: donor.id,
      entityName: donor.name,
    });
  });

  // Major donors without recent outreach (no follow-up tasks in last 60 days)
  const majorDonors = donors.filter(d => d.donorCategory === "major");
  majorDonors.slice(0, 2).forEach(donor => {
    const recentTasks = followUpTasks.filter(t =>
      t.donorId === donor.id &&
      t.createdAt > new Date(Date.now() - 60 * 24 * 60 * 60 * 1000)
    );
    if (recentTasks.length === 0) {
      alerts.push({
        id: alertId++,
        type: "major-donor-outreach",
        severity: "info",
        message: `Major donor ${donor.name} has not received outreach recently`,
        eventId: null,
        donorId: donor.id,
        entityName: donor.name,
      });
    }
  });

  // Unusual large revenue amounts (> $10,000 in single entry)
  revenueEntries.filter(r => parseFloat(r.amount as string) > 10000).forEach(entry => {
    const event = events.find(e => e.id === entry.eventId);
    alerts.push({
      id: alertId++,
      type: "large-amount",
      severity: "info",
      message: `Unusually large revenue entry of $${parseFloat(entry.amount as string).toFixed(2)} recorded for "${event?.name}"`,
      eventId: entry.eventId,
      donorId: null,
      entityName: event?.name ?? null,
    });
  });

  res.json(alerts.slice(0, 20));
});

router.get("/dashboard/donor-segments", async (_req, res): Promise<void> => {
  const donors = await db.select().from(donorsTable);

  res.json({
    oneTime: donors.filter(d => d.donorCategory === "one-time").length,
    recurring: donors.filter(d => d.donorCategory === "recurring").length,
    seasonal: donors.filter(d => d.donorCategory === "seasonal").length,
    major: donors.filter(d => d.donorCategory === "major").length,
    lapsed: donors.filter(d => d.donorCategory === "lapsed").length,
    emergencyResponder: donors.filter(d => d.donorCategory === "emergency-responder").length,
    altruist: donors.filter(d => d.donorPersonalityType === "Altruist").length,
    investor: donors.filter(d => d.donorPersonalityType === "Investor").length,
    repayer: donors.filter(d => d.donorPersonalityType === "Repayer").length,
    totalDonors: donors.length,
  });
});

router.get("/dashboard/top-events", async (_req, res): Promise<void> => {
  const [events, revenueEntries, attendees] = await Promise.all([
    db.select().from(eventsTable),
    db.select().from(revenueEntriesTable),
    db.select().from(attendeesTable),
  ]);

  const eventPerformance = events.map(event => {
    const revenue = revenueEntries.filter(r => r.eventId === event.id).reduce((sum, r) => sum + parseFloat(r.amount as string), 0);
    const eventAttendees = attendees.filter(a => a.eventId === event.id && a.attended);
    const donors = attendees.filter(a => a.eventId === event.id && a.donated);

    return {
      eventId: event.id,
      eventName: event.name,
      date: event.date,
      totalRevenue: revenue,
      attendeeCount: eventAttendees.length,
      donorConversionRate: eventAttendees.length > 0 ? donors.length / eventAttendees.length : 0,
      eventType: event.eventType,
      location: event.location,
    };
  });

  // Sort by total revenue descending
  eventPerformance.sort((a, b) => b.totalRevenue - a.totalRevenue);
  res.json(eventPerformance.slice(0, 10));
});

router.get("/dashboard/upcoming-events", async (_req, res): Promise<void> => {
  const events = await db.select().from(eventsTable);
  const today = new Date();

  const upcoming = events
    .filter(e => new Date(e.date) > today && e.status !== "closed")
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, 10)
    .map(e => ({
      id: e.id,
      name: e.name,
      date: e.date,
      eventType: e.eventType,
      status: e.status,
      location: e.location,
    }));

  res.json(upcoming);
});

export default router;
