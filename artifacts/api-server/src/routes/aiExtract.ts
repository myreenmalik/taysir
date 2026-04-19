import { Router, type IRouter, type Request, type Response } from "express";
import OpenAI from "openai";

const router: IRouter = Router();

const openai = new OpenAI({
  apiKey: process.env["AI_INTEGRATIONS_OPENAI_API_KEY"] ?? "",
  baseURL: process.env["AI_INTEGRATIONS_OPENAI_BASE_URL"],
});

type SheetInput = { name: string; rows: unknown[][] };

const CHUNK_SIZE = 120;
const HEADER_CONTEXT = 6;
const MAX_CHUNK_CONCURRENCY = 3;
const MAX_TOTAL_ROWS = 10_000;

const SYSTEM_PROMPT = `You extract structured donor, event, and revenue records from messy non-profit fundraising spreadsheets. Always respond with valid JSON matching the requested shape.

For every record you extract, include these metadata fields:
- "_confidence": "high" | "medium" | "low"
- "_reason": short string — only required when confidence is medium/low or when you made a notable inference (e.g. inferred a payment method, merged two columns, guessed a date)
- "_source": object mapping field names to their ORIGINAL raw cell value, for any field where you cleaned, normalized, inferred, or merged the value. Omit fields where you used the cell as-is.

Set confidence based on:
- "high": all required fields are explicit in the source, no inference needed
- "medium": you inferred a value from context (e.g. payment method from "cc"), normalized casing/format, or merged split columns
- "low": you guessed at a value, the source was ambiguous, the row looks like it might be a duplicate or test data, or required fields are missing
`;

type ChunkPlan = { sheet: string; chunkNum: number; totalChunks: number; dataStartRow: number; rows: unknown[][] };

function planChunks(sheets: SheetInput[]): ChunkPlan[] {
  const plans: ChunkPlan[] = [];
  for (const s of sheets) {
    const rows = Array.isArray(s.rows) ? s.rows : [];
    if (rows.length <= CHUNK_SIZE) {
      plans.push({ sheet: s.name, chunkNum: 1, totalChunks: 1, dataStartRow: 0, rows });
      continue;
    }
    // First chunk: rows 0..CHUNK_SIZE
    const first = rows.slice(0, CHUNK_SIZE);
    const remaining = rows.slice(CHUNK_SIZE);
    const subsequentChunks = Math.ceil(remaining.length / CHUNK_SIZE);
    const totalChunks = 1 + subsequentChunks;
    plans.push({ sheet: s.name, chunkNum: 1, totalChunks, dataStartRow: 0, rows: first });
    for (let i = 0; i < subsequentChunks; i++) {
      const start = CHUNK_SIZE + i * CHUNK_SIZE;
      const window = rows.slice(start, start + CHUNK_SIZE);
      const headerCtx = rows.slice(0, HEADER_CONTEXT);
      plans.push({
        sheet: s.name,
        chunkNum: i + 2,
        totalChunks,
        dataStartRow: HEADER_CONTEXT,
        rows: [...headerCtx, ...window],
      });
    }
  }
  return plans;
}

function renderRows(rows: unknown[][]): string {
  return rows.map((row, i) => {
    const cells = (row || []).map(c => {
      const str = c == null ? "" : String(c);
      return str.length > 80 ? str.slice(0, 80) + "..." : str;
    });
    return `R${i}: ${cells.join(" | ")}`;
  }).join("\n");
}

function buildPrompt(plan: ChunkPlan): string {
  const isContinuation = plan.chunkNum > 1;
  const chunkNote = plan.totalChunks > 1
    ? `This is CHUNK ${plan.chunkNum} of ${plan.totalChunks} for sheet "${plan.sheet}".${isContinuation ? ` The first ${HEADER_CONTEXT} rows (R0-R${HEADER_CONTEXT - 1}) are HEADER CONTEXT from earlier in the sheet. Do NOT extract records from those rows — they were already processed in chunk 1. Only extract records from R${plan.dataStartRow} onward.` : ""}`
    : `This is the only chunk for sheet "${plan.sheet}".`;

  return `${chunkNote}

Common messiness to handle:
- Title rows above the real header row
- Empty spacer columns between real columns
- Same logical field split across multiple physical columns (merge them)
- Inconsistent casing (normalize names to title case)
- Footer rows like "total" — skip these
- Currency symbols and commas in amounts
- Payment method codes ("cc" → card, "ACH", "Venmo")

Schemas:

DONOR record (one per donor contribution; multiple gifts from same person = separate records):
{
  "name": string (required, title case),
  "email": string,
  "phone": string,
  "location": string,
  "amount": number (dollars, no symbols),
  "date": "YYYY-MM-DD",
  "campaign": string,
  "donationType": "one-time" | "recurring" | "zakat" | "sadaqah" | "waqf" | "other",
  "paymentMethod": "cash" | "check" | "card" | "ach" | "wire" | "paypal" | "venmo" | "other",
  "notes": string,
  "_confidence": "high" | "medium" | "low",
  "_reason": string (when medium/low or notable inference),
  "_source": { "<field>": "<original cell value>", ... }
}

EVENT record:
{
  "name": string (required),
  "date": "YYYY-MM-DD" (required),
  "location": string (required),
  "eventType": string (required: "fundraiser" | "gala" | "iftar" | "conference" | "other"),
  "campaign": string,
  "notes": string,
  "_confidence", "_reason", "_source"
}

REVENUE record (event income breakdowns):
{
  "eventName": string (used to match an event by name),
  "paymentType": string (required: cash/check/card/etc),
  "amount": number (required),
  "quantity": integer,
  "notes": string,
  "_confidence", "_reason", "_source"
}

If a field isn't present, OMIT it. Do NOT invent data.

SKIP sheets that are pure summaries / totals / cash counts unless this chunk has none — in that case return empty arrays.

Workbook chunk:

=== Sheet: ${plan.sheet} (chunk ${plan.chunkNum}/${plan.totalChunks}) ===
${renderRows(plan.rows)}

Respond with strict JSON:
{
  "donors": [ ... ],
  "events": [ ... ],
  "revenue": [ ... ],
  "ignored": boolean,
  "ignoreReason": string,
  "notes": string
}`;
}

type ChunkResult = {
  donors: Record<string, unknown>[];
  events: Record<string, unknown>[];
  revenue: Record<string, unknown>[];
  ignored: boolean;
  ignoreReason: string;
  notes: string;
  sheet: string;
};

async function runChunk(plan: ChunkPlan): Promise<ChunkResult> {
  const completion = await openai.chat.completions.create({
    model: "gpt-5.2",
    max_completion_tokens: 16384,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: buildPrompt(plan) },
    ],
  });
  const raw = completion.choices[0]?.message?.content ?? "{}";
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = {};
  }
  const arr = (k: string): Record<string, unknown>[] => {
    const v = parsed[k];
    return Array.isArray(v)
      ? v.filter((r): r is Record<string, unknown> => !!r && typeof r === "object" && !Array.isArray(r))
      : [];
  };
  return {
    donors: arr("donors"),
    events: arr("events"),
    revenue: arr("revenue"),
    ignored: parsed.ignored === true,
    ignoreReason: typeof parsed.ignoreReason === "string" ? parsed.ignoreReason : "",
    notes: typeof parsed.notes === "string" ? parsed.notes : "",
    sheet: plan.sheet,
  };
}

async function runWithConcurrency<T, R>(items: T[], limit: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const idx = i++;
      if (idx >= items.length) return;
      results[idx] = await fn(items[idx]);
    }
  });
  await Promise.all(workers);
  return results;
}

router.post("/import/ai-extract", async (req: Request, res: Response) => {
  const body = req.body as { sheets?: SheetInput[] };
  if (!Array.isArray(body.sheets) || body.sheets.length === 0) {
    res.status(400).json({ error: "Missing sheets" });
    return;
  }

  const totalRows = body.sheets.reduce((n, s) => n + (Array.isArray(s.rows) ? s.rows.length : 0), 0);
  if (totalRows > MAX_TOTAL_ROWS) {
    res.status(413).json({ error: `Workbook too large: ${totalRows} rows (max ${MAX_TOTAL_ROWS}). Please split it into smaller files.` });
    return;
  }

  const sheets = body.sheets.map(s => ({
    name: String(s.name ?? "Sheet"),
    rows: Array.isArray(s.rows) ? s.rows : [],
  }));

  const plans = planChunks(sheets);

  try {
    const chunkResults = await runWithConcurrency(plans, MAX_CHUNK_CONCURRENCY, runChunk);

    // If a sheet was marked ignored on its FIRST chunk, drop all extractions from any of its chunks.
    const ignoredOnChunk1 = new Map<string, string>();
    chunkResults.forEach((r, i) => {
      if (plans[i].chunkNum === 1 && r.ignored) ignoredOnChunk1.set(r.sheet, r.ignoreReason);
    });
    const sheetsIgnored = Array.from(ignoredOnChunk1, ([name, reason]) => ({ name, reason }));

    const donors: Record<string, unknown>[] = [];
    const events: Record<string, unknown>[] = [];
    const revenue: Record<string, unknown>[] = [];
    const allNotes: string[] = [];

    for (const r of chunkResults) {
      if (ignoredOnChunk1.has(r.sheet)) continue;
      donors.push(...r.donors);
      events.push(...r.events);
      revenue.push(...r.revenue);
      if (r.notes) allNotes.push(`[${r.sheet}] ${r.notes}`);
    }

    res.json({
      donors,
      events,
      revenue,
      ignoredSheets: sheetsIgnored,
      notes: allNotes.join(" | "),
      stats: {
        sheetsProcessed: sheets.length,
        chunksRun: plans.length,
        totalRows,
      },
    });
  } catch (err) {
    req.log.error({ err }, "AI extract failed");
    const msg = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: `AI extract failed: ${msg}` });
  }
});

export default router;
