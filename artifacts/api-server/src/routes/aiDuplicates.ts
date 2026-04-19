import { Router, type IRouter, type Request, type Response } from "express";
import { sql } from "drizzle-orm";
import { db, donorsTable } from "@workspace/db";

const router: IRouter = Router();

type DonorCandidateInput = { name?: unknown; email?: unknown };

router.post("/import/ai-preview-duplicates", async (req: Request, res: Response) => {
  const body = req.body as { donors?: DonorCandidateInput[] };
  if (!Array.isArray(body.donors)) {
    res.status(400).json({ error: "donors must be an array" });
    return;
  }

  // Pull all donors once (small dataset for hackathon scale).
  const all = await db.select({
    id: donorsTable.id,
    name: donorsTable.name,
    email: donorsTable.email,
    totalDonated: donorsTable.totalDonated,
    donationCount: donorsTable.donationCount,
  }).from(donorsTable);

  const byEmail = new Map<string, typeof all[number]>();
  const byNameLower = new Map<string, typeof all[number][]>();
  for (const d of all) {
    if (d.email) byEmail.set(d.email.toLowerCase(), d);
    const k = d.name.toLowerCase().trim();
    const arr = byNameLower.get(k) ?? [];
    arr.push(d);
    byNameLower.set(k, arr);
  }

  const matches = body.donors.map((row, index) => {
    const name = typeof row.name === "string" ? row.name.trim() : "";
    const email = typeof row.email === "string" ? row.email.trim().toLowerCase() : "";

    const candidates: Array<{ id: number; name: string; email: string | null; totalDonated: string; donationCount: number; matchedOn: string }> = [];

    if (email) {
      const m = byEmail.get(email);
      if (m) candidates.push({ ...m, matchedOn: "email" });
    }
    if (name) {
      const exact = byNameLower.get(name.toLowerCase()) ?? [];
      for (const m of exact) {
        if (!candidates.find(c => c.id === m.id)) candidates.push({ ...m, matchedOn: "name" });
      }
    }

    return {
      index,
      candidates,
      suggestion: candidates.length > 0 ? "merge" : "create",
    };
  });

  res.json({ matches });
});

export default router;
