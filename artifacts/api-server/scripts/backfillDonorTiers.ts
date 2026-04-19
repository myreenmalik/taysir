/**
 * One-time (and idempotent) backfill that recomputes donor tier, category,
 * and personality for every donor in the database from their donation history.
 *
 * Run from the repo root:
 *   pnpm --filter @workspace/api-server run backfill:donor-tiers
 *
 * Safe to re-run any time: it only re-derives values from existing data and
 * writes the same fields that recomputeDonorStats writes after a normal
 * donation mutation.
 */
import { db, donorsTable } from "@workspace/db";
import { recomputeDonorStats } from "../src/lib/donorStats";

async function main() {
  const donors = await db.select({ id: donorsTable.id }).from(donorsTable);
  console.log(`Backfilling donor tier + personality for ${donors.length} donors...`);
  let ok = 0;
  let fail = 0;
  for (const d of donors) {
    try {
      await recomputeDonorStats(d.id);
      ok++;
    } catch (e) {
      fail++;
      console.error(`Donor ${d.id} failed:`, (e as Error).message);
    }
  }
  console.log(`Done. Updated ${ok} donor${ok === 1 ? "" : "s"}, ${fail} failure${fail === 1 ? "" : "s"}.`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
