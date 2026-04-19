import { Router, type IRouter, type Request, type Response } from "express";
import OpenAI from "openai";
import { sql, inArray } from "drizzle-orm";
import { db, mappingCorrectionsTable } from "@workspace/db";

const router: IRouter = Router();

const openai = new OpenAI({
  apiKey: process.env["AI_INTEGRATIONS_OPENAI_API_KEY"] ?? "",
  baseURL: process.env["AI_INTEGRATIONS_OPENAI_BASE_URL"],
});

// The unified target schema. Each entity exposes its fields. The AI maps
// each spreadsheet column to (entity, field) or null.
const TARGET_SCHEMA = {
  donors: [
    { key: "name", label: "Name", required: true, type: "string" },
    { key: "email", label: "Email", required: false, type: "string" },
    { key: "phone", label: "Phone", required: false, type: "string" },
    { key: "location", label: "Location", required: false, type: "string" },
    { key: "notes", label: "Notes", required: false, type: "string" },
  ],
  donations: [
    // donorId/eventId are linked at commit time, not from spreadsheet columns.
    { key: "amount", label: "Amount", required: true, type: "number" },
    { key: "date", label: "Date", required: false, type: "date" },
    { key: "campaign", label: "Campaign", required: false, type: "string" },
    { key: "cause", label: "Cause/Fund", required: false, type: "string" },
    { key: "donationType", label: "Donation Type", required: false, type: "string" },
    { key: "paymentMethod", label: "Payment Method", required: false, type: "string" },
    { key: "season", label: "Season", required: false, type: "string" },
    { key: "notes", label: "Notes", required: false, type: "string" },
  ],
  events: [
    { key: "name", label: "Event Name", required: true, type: "string" },
    { key: "date", label: "Date", required: true, type: "date" },
    { key: "location", label: "Location", required: true, type: "string" },
    { key: "eventType", label: "Event Type", required: true, type: "string" },
    { key: "campaign", label: "Campaign", required: false, type: "string" },
    { key: "estimatedAttendees", label: "Estimated Attendees", required: false, type: "integer" },
    { key: "notes", label: "Notes", required: false, type: "string" },
  ],
  revenue: [
    { key: "amount", label: "Amount", required: true, type: "number" },
    { key: "paymentType", label: "Payment Type", required: true, type: "string" },
    { key: "eventName", label: "Linked Event Name", required: false, type: "string" },
    { key: "date", label: "Date", required: false, type: "date" },
    { key: "notes", label: "Notes", required: false, type: "string" },
  ],
} as const;

type Entity = keyof typeof TARGET_SCHEMA;

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, " ");
}

function buildSchemaList(): string {
  return (Object.keys(TARGET_SCHEMA) as Entity[]).map(entity => {
    const fields = TARGET_SCHEMA[entity].map(f =>
      `  - ${entity}.${f.key} (${f.type}${f.required ? ", required" : ""}): ${f.label}`,
    ).join("\n");
    return `${entity.toUpperCase()}:\n${fields}`;
  }).join("\n\n");
}

router.post("/import/analyze-sheet", async (req: Request, res: Response) => {
  const body = req.body as { headers?: string[]; sampleRows?: Record<string, unknown>[] };
  const headers = Array.isArray(body.headers) ? body.headers.filter(h => typeof h === "string" && h.trim()) : [];
  const sampleRows = Array.isArray(body.sampleRows) ? body.sampleRows.slice(0, 8) : [];
  if (headers.length === 0) {
    res.status(400).json({ error: "headers must be a non-empty array" });
    return;
  }

  // Pull saved corrections for these headers up-front.
  const headerNorms = headers.map(normalizeHeader);
  const corrections = headerNorms.length === 0
    ? []
    : await db.select().from(mappingCorrectionsTable)
        .where(inArray(mappingCorrectionsTable.headerNorm, headerNorms));
  const correctionByHeader = new Map<string, { entity: string; field: string; useCount: number }>();
  for (const c of corrections) {
    const prev = correctionByHeader.get(c.headerNorm);
    // For a header with multiple saved targets, keep the most-used one.
    if (!prev || c.useCount > prev.useCount) {
      correctionByHeader.set(c.headerNorm, { entity: c.entity, field: c.field, useCount: c.useCount });
    }
  }

  const sampleTable = sampleRows.length
    ? sampleRows.map((row, i) => {
        const cells = headers.map(h => `${h}=${JSON.stringify(row[h] ?? "")}`).join(" | ");
        return `Row ${i + 1}: ${cells}`;
      }).join("\n")
    : "(no sample rows provided)";

  const prompt = `You are analyzing a fundraising spreadsheet uploaded by an Islamic Relief USA staff member. Your job is two things at once:

A) DETECT which entity types (donors, donations, events) are present in this sheet, and roughly how many rows of each.

B) For each spreadsheet column, decide which target field it maps to in our schema (an entity + field combo, or null if it's junk/unmappable).

Spreadsheet columns:
${headers.map(h => `- ${JSON.stringify(h)}`).join("\n")}

Sample data (first ${sampleRows.length} rows):
${sampleTable}

Target schema:
${buildSchemaList()}

Rules:
- Many real-world sheets MIX entity types in one row (donor info + their donation in the same row). When that happens, return BOTH entities in entitiesPresent and map donor-y columns to "donors.*" and donation-y columns to "donations.*".
- A given target (entity.field) can be used by AT MOST ONE column. Pick the best column.
- Use both the column header AND the sample values to decide. e.g. a column called "Amount" with values like "$500" is donations.amount.
- For mixed columns or junk, return null for that column.
- Confidence: "high" if the mapping is obvious from header+samples; "medium" if you had to infer; "low" if you guessed.
- For entitiesPresent, count by looking at sample rows: if every row has a donor name and an amount, that's "donors AND donations" with the same count. Estimate counts using the visible row count.

Respond with strict JSON in this exact shape:
{
  "entitiesPresent": [
    { "entity": "donors" | "donations" | "events", "estimatedCount": number, "confidence": "high"|"medium"|"low", "reason": "<short>" }
  ],
  "mapping": {
    "<column header>": { "entity": "donors"|"donations"|"events", "field": "<field key>", "confidence": "high"|"medium"|"low", "reason": "<short>" } OR null
  },
  "notes": "<one short sentence about anything ambiguous>"
}`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 4096,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "You analyze messy non-profit fundraising spreadsheets. Always respond with valid JSON matching the requested shape." },
        { role: "user", content: prompt },
      ],
    });
    const raw = completion.choices[0]?.message?.content ?? "{}";
    let parsed: {
      entitiesPresent?: Array<{ entity?: string; estimatedCount?: number; confidence?: string; reason?: string }>;
      mapping?: Record<string, { entity?: string; field?: string; confidence?: string; reason?: string } | null>;
      notes?: string;
    };
    try {
      parsed = JSON.parse(raw);
    } catch {
      res.status(502).json({ error: "AI returned non-JSON response", raw });
      return;
    }

    // Validate + clean
    const validEntities = new Set(Object.keys(TARGET_SCHEMA));
    const fieldKeysByEntity: Record<string, Set<string>> = {};
    for (const e of validEntities) {
      fieldKeysByEntity[e] = new Set(TARGET_SCHEMA[e as Entity].map(f => f.key));
    }
    const usedTargets = new Set<string>();

    const cleanMapping: Record<
      string,
      { entity: string; field: string; confidence: string; reason: string; source: "ai" | "saved" } | null
    > = {};

    // Pass 1: apply saved corrections (priority — they overrule AI).
    for (const header of headers) {
      const norm = normalizeHeader(header);
      const saved = correctionByHeader.get(norm);
      if (saved && validEntities.has(saved.entity) && fieldKeysByEntity[saved.entity]?.has(saved.field)) {
        const targetKey = `${saved.entity}.${saved.field}`;
        if (!usedTargets.has(targetKey)) {
          cleanMapping[header] = { entity: saved.entity, field: saved.field, confidence: "high", reason: "From saved correction", source: "saved" };
          usedTargets.add(targetKey);
          continue;
        }
      }
      cleanMapping[header] = null;
    }

    // Pass 2: apply AI suggestions for un-mapped columns.
    for (const header of headers) {
      if (cleanMapping[header]) continue;
      const sug = parsed.mapping?.[header];
      if (!sug || typeof sug !== "object") continue;
      const entity = String(sug.entity ?? "");
      const field = String(sug.field ?? "");
      if (!validEntities.has(entity) || !fieldKeysByEntity[entity]?.has(field)) continue;
      const targetKey = `${entity}.${field}`;
      if (usedTargets.has(targetKey)) continue;
      const conf = ["high", "medium", "low"].includes(String(sug.confidence)) ? String(sug.confidence) : "medium";
      cleanMapping[header] = {
        entity,
        field,
        confidence: conf,
        reason: typeof sug.reason === "string" ? sug.reason : "",
        source: "ai",
      };
      usedTargets.add(targetKey);
    }

    const cleanEntities = (Array.isArray(parsed.entitiesPresent) ? parsed.entitiesPresent : [])
      .filter(e => validEntities.has(String(e.entity)))
      .map(e => ({
        entity: String(e.entity),
        estimatedCount: typeof e.estimatedCount === "number" ? Math.max(0, Math.round(e.estimatedCount)) : 0,
        confidence: ["high", "medium", "low"].includes(String(e.confidence)) ? String(e.confidence) : "medium",
        reason: typeof e.reason === "string" ? e.reason : "",
      }));

    res.json({
      entitiesPresent: cleanEntities,
      mapping: cleanMapping,
      notes: typeof parsed.notes === "string" ? parsed.notes : "",
      schema: TARGET_SCHEMA,
    });
  } catch (err) {
    req.log.error({ err }, "analyze-sheet failed");
    const msg = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: `Analyze failed: ${msg}` });
  }
});

router.get("/import/mapping-corrections", async (_req: Request, res: Response) => {
  const all = await db.select().from(mappingCorrectionsTable);
  res.json({ corrections: all });
});

router.post("/import/mapping-corrections", async (req: Request, res: Response) => {
  const body = req.body as { corrections?: Array<{ header?: string; entity?: string; field?: string }> };
  const items = Array.isArray(body.corrections) ? body.corrections : [];
  let saved = 0;
  for (const c of items) {
    if (typeof c.header !== "string" || typeof c.entity !== "string" || typeof c.field !== "string") continue;
    const norm = normalizeHeader(c.header);
    if (!norm) continue;
    try {
      await db.insert(mappingCorrectionsTable)
        .values({ headerNorm: norm, entity: c.entity, field: c.field })
        .onConflictDoUpdate({
          target: [mappingCorrectionsTable.headerNorm, mappingCorrectionsTable.entity, mappingCorrectionsTable.field],
          set: { useCount: sql`${mappingCorrectionsTable.useCount} + 1`, lastUsed: new Date() },
        });
      saved++;
    } catch (err) {
      req.log.error({ err, c }, "Failed to save mapping correction");
    }
  }
  res.json({ saved });
});

export default router;
