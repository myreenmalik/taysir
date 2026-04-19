import { Router, type IRouter, type Request, type Response } from "express";
import OpenAI from "openai";

const router: IRouter = Router();

const openai = new OpenAI({
  apiKey: process.env["AI_INTEGRATIONS_OPENAI_API_KEY"] ?? "",
  baseURL: process.env["AI_INTEGRATIONS_OPENAI_BASE_URL"],
});

type SheetInput = { name: string; rows: unknown[][] };

router.post("/import/ai-extract", async (req: Request, res: Response) => {
  const body = req.body as { sheets?: SheetInput[] };
  if (!Array.isArray(body.sheets) || body.sheets.length === 0) {
    res.status(400).json({ error: "Missing sheets" });
    return;
  }

  const MAX_ROWS_PER_SHEET = 200;
  const trimmedSheets = body.sheets.map(s => ({
    name: String(s.name ?? "Sheet"),
    rows: (Array.isArray(s.rows) ? s.rows : []).slice(0, MAX_ROWS_PER_SHEET),
  }));

  const sheetBlocks = trimmedSheets.map(s => {
    const lines = s.rows.map((row, i) => {
      const cells = (row || []).map(c => {
        const str = c == null ? "" : String(c);
        return str.length > 80 ? str.slice(0, 80) + "..." : str;
      });
      return `R${i}: ${cells.join(" | ")}`;
    });
    return `=== Sheet: ${s.name} (${s.rows.length} rows shown) ===\n${lines.join("\n")}`;
  }).join("\n\n");

  const prompt = `You are an expert data analyst importing a messy non-profit fundraising spreadsheet into a clean database.

The user uploaded a workbook with one or more sheets. Some sheets contain importable donor/donation records, others are summaries, totals, or cash counts that should be IGNORED.

Common messiness to handle:
- Title rows above the real header row (e.g. row 0 is "Islamic Relief USA - April Fundraiser", real headers are on row 2 or 3)
- Empty spacer columns between real columns
- The same logical field split across multiple physical columns (e.g. "Amount" appears in column D for some rows and column E for others — treat those as the SAME field)
- Inconsistent casing (normalize names to title case: "OMAR HASSAN" → "Omar Hassan")
- Footer rows like "total"
- Free-text duplicate flags in notes columns
- Currency symbols and commas in amounts ("$1,250.00" → 1250)
- Payment method columns scattered: "paid?", "method", etc.

Your task: extract a single unified list of donor records. Each record represents one donor's contribution. Multiple gifts from the same person should be separate records (we'll dedupe donors by email later).

Output schema for each row (only include fields you can determine — omit unknowns, do not guess):
{
  "name": string (required, normalized to title case),
  "email": string,
  "phone": string,
  "location": string,
  "amount": number (in dollars, just the number),
  "date": string in YYYY-MM-DD,
  "campaign": string,
  "donationType": string (one of: "one-time", "recurring", "zakat", "sadaqah", "waqf", "other"),
  "paymentMethod": string (e.g. "cash", "check", "card", "ach", "wire", "paypal"),
  "notes": string (anything else interesting)
}

Here is the workbook (cells joined by " | ", row numbers shown as R0, R1, ...):

${sheetBlocks}

Respond with strict JSON in this exact shape:
{
  "rows": [ { "name": "...", ... }, ... ],
  "ignoredSheets": [ { "name": "<sheet name>", "reason": "<short reason>" } ],
  "notes": "<one short paragraph: which sheets were used, what assumptions you made, what the user should double-check>"
}`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 8192,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "You extract structured donor records from messy fundraising spreadsheets. Always respond with valid JSON matching the requested shape." },
        { role: "user", content: prompt },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    let parsed: {
      rows?: unknown[];
      ignoredSheets?: Array<{ name?: string; reason?: string }>;
      notes?: string;
    };
    try {
      parsed = JSON.parse(raw);
    } catch {
      res.status(502).json({ error: "AI returned non-JSON response", raw });
      return;
    }

    const rows = Array.isArray(parsed.rows)
      ? parsed.rows.filter((r): r is Record<string, unknown> => !!r && typeof r === "object" && !Array.isArray(r))
      : [];

    const ignoredSheets = (parsed.ignoredSheets ?? [])
      .filter(s => s && typeof s === "object")
      .map(s => ({
        name: String(s.name ?? ""),
        reason: typeof s.reason === "string" ? s.reason : "",
      }));

    res.json({
      rows,
      ignoredSheets,
      notes: typeof parsed.notes === "string" ? parsed.notes : "",
    });
  } catch (err) {
    req.log.error({ err }, "AI extract failed");
    const msg = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: `AI extract failed: ${msg}` });
  }
});

export default router;
