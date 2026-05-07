import app from "./app";
import { logger } from "./lib/logger";
import { db, donorsTable } from "@workspace/db";
import { sql } from "drizzle-orm";
import { seedDonors } from "../scripts/seedDonors";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// Auto-seed donor demo data on startup.
// - If donors table is sparse (< 30) → seed it (fresh prod after deploy).
// - If there are orphan donors with no donations → re-seed to clean them up.
// The seed is idempotent (upserts by email, removes only seed-tagged data).
async function ensureSeeded(): Promise<void> {
  try {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(donorsTable);
    const orphanResult = await db.execute(
      sql`SELECT COUNT(*)::int AS orphans FROM donors d LEFT JOIN donations dn ON dn.donor_id = d.id WHERE dn.id IS NULL`,
    );
    const orphans = (orphanResult.rows[0] as { orphans: number } | undefined)?.orphans ?? 0;
    if (count < 30 || orphans > 0) {
      logger.info({ existingDonors: count, orphans }, "Auto-seeding donor demo data");
      await seedDonors();
      logger.info("Auto-seed complete");
    }
  } catch (err) {
    logger.error({ err }, "Auto-seed failed (continuing startup)");
  }
}

void ensureSeeded();

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
