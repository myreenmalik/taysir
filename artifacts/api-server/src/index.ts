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

// Auto-seed donor demo data if the donors table is sparse.
// This makes a freshly-deployed production environment match dev,
// since Replit's publish flow doesn't copy seed data across DBs.
async function ensureSeeded(): Promise<void> {
  try {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(donorsTable);
    if (count < 30) {
      logger.info({ existingDonors: count }, "Auto-seeding donor demo data");
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
