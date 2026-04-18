import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, logisticsTasksTable } from "@workspace/db";
import {
  ListLogisticsTasksParams,
  CreateLogisticsTaskParams,
  CreateLogisticsTaskBody,
  UpdateLogisticsTaskParams,
  UpdateLogisticsTaskBody,
  DeleteLogisticsTaskParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/events/:eventId/logistics", async (req, res): Promise<void> => {
  const params = ListLogisticsTasksParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const tasks = await db.select().from(logisticsTasksTable)
    .where(eq(logisticsTasksTable.eventId, params.data.eventId))
    .orderBy(logisticsTasksTable.createdAt);

  res.json(tasks.map(t => ({ ...t, createdAt: t.createdAt.toISOString() })));
});

router.post("/events/:eventId/logistics", async (req, res): Promise<void> => {
  const params = CreateLogisticsTaskParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = CreateLogisticsTaskBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [task] = await db.insert(logisticsTasksTable).values({
    eventId: params.data.eventId,
    taskName: parsed.data.taskName,
    assignedTo: parsed.data.assignedTo ?? null,
    dueDate: parsed.data.dueDate ?? null,
    status: parsed.data.status ?? "pending",
    notes: parsed.data.notes ?? null,
  }).returning();

  res.status(201).json({ ...task, createdAt: task.createdAt.toISOString() });
});

router.patch("/logistics/:id", async (req, res): Promise<void> => {
  const params = UpdateLogisticsTaskParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateLogisticsTaskBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updateData: Record<string, unknown> = {};
  if (parsed.data.taskName !== undefined) updateData.taskName = parsed.data.taskName;
  if ("assignedTo" in parsed.data) updateData.assignedTo = parsed.data.assignedTo;
  if ("dueDate" in parsed.data) updateData.dueDate = parsed.data.dueDate;
  if (parsed.data.status !== undefined) updateData.status = parsed.data.status;
  if ("notes" in parsed.data) updateData.notes = parsed.data.notes;

  const [task] = await db.update(logisticsTasksTable).set(updateData).where(eq(logisticsTasksTable.id, params.data.id)).returning();
  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  res.json({ ...task, createdAt: task.createdAt.toISOString() });
});

router.delete("/logistics/:id", async (req, res): Promise<void> => {
  const params = DeleteLogisticsTaskParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [task] = await db.delete(logisticsTasksTable).where(eq(logisticsTasksTable.id, params.data.id)).returning();
  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
