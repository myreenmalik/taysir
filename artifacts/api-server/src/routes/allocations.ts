import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, allocationsTable } from "@workspace/db";
import {
  ListAllocationsParams,
  CreateAllocationParams,
  CreateAllocationBody,
  UpdateAllocationParams,
  UpdateAllocationBody,
  DeleteAllocationParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

function serializeAllocation(a: typeof allocationsTable.$inferSelect) {
  return { ...a, amount: parseFloat(a.amount as string), createdAt: a.createdAt.toISOString() };
}

router.get("/events/:eventId/allocations", async (req, res): Promise<void> => {
  const params = ListAllocationsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const allocations = await db.select().from(allocationsTable).where(eq(allocationsTable.eventId, params.data.eventId));
  res.json(allocations.map(serializeAllocation));
});

router.post("/events/:eventId/allocations", async (req, res): Promise<void> => {
  const params = CreateAllocationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = CreateAllocationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [allocation] = await db.insert(allocationsTable).values({
    eventId: params.data.eventId,
    category: parsed.data.category,
    amount: String(parsed.data.amount),
    notes: parsed.data.notes ?? null,
  }).returning();

  res.status(201).json(serializeAllocation(allocation));
});

router.patch("/allocations/:id", async (req, res): Promise<void> => {
  const params = UpdateAllocationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateAllocationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updateData: Record<string, unknown> = {};
  if (parsed.data.category !== undefined) updateData.category = parsed.data.category;
  if (parsed.data.amount !== undefined) updateData.amount = String(parsed.data.amount);
  if ("notes" in parsed.data) updateData.notes = parsed.data.notes;

  const [allocation] = await db.update(allocationsTable).set(updateData).where(eq(allocationsTable.id, params.data.id)).returning();
  if (!allocation) {
    res.status(404).json({ error: "Allocation not found" });
    return;
  }

  res.json(serializeAllocation(allocation));
});

router.delete("/allocations/:id", async (req, res): Promise<void> => {
  const params = DeleteAllocationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [allocation] = await db.delete(allocationsTable).where(eq(allocationsTable.id, params.data.id)).returning();
  if (!allocation) {
    res.status(404).json({ error: "Allocation not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
