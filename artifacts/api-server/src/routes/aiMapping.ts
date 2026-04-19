import { Router, type IRouter, type Request, type Response } from "express";
import OpenAI from "openai";

const router: IRouter = Router();

const openai = new OpenAI({
  apiKey: process.env["AI_INTEGRATIONS_OPENAI_API_KEY"] ?? "",
  baseURL: process.env["AI_INTEGRATIONS_OPENAI_BASE_URL"],
});

type FieldDef = {
  key: string;
  label: string;
  required: boolean;
  type: "string" | "number" | "date" | "integer";
};

type SuggestRequest = {
  dataType: string;
  headers: string[];
  sampleRows: Record<string, unknown>[];
  targetFields: FieldDef[];
};

router.post("/import/suggest-mapping", async (req: Request, res: Response) => {
  const body = req.body as Partial<SuggestRequest>;
  if (!body.dataType || !Array.isArray(body.headers) || !Array.isArray(body.targetFields)) {
    res.status(400).json({ error: "Missing dataType, headers, or targetFields" });
    return;
  }
  const headers = body.headers.filter(h => typeof h === "string");
  if (headers.length === 0) {
    res.json({ mapping: {}, notes: "No headers provided." });
    return;
  }

  const sampleRows = (body.sampleRows ?? []).slice(0, 5);
  const targetFields = body.targetFields;

  const fieldList = targetFields
    .map(f => `- ${f.key} (${f.type}${f.required ? ", required" : ""}): ${f.label}`)
    .join("\n");

  const sampleTable = sampleRows.length
    ? sampleRows
        .map((row, i) => {
          const cells = headers.map(h => `${h}=${JSON.stringify(row[h] ?? "")}`).join(" | ");
          return `Row ${i + 1}: ${cells}`;
        })
        .join("\n")
    : "(no sample rows provided)";

  const prompt = `You are mapping spreadsheet columns to a database schema for "${body.dataType}".

Spreadsheet columns:
${headers.map(h => `- ${JSON.stringify(h)}`).join("\n")}

Sample data (first ${sampleRows.length} rows):
${sampleTable}

Target schema fields:
${fieldList}

Task: For each spreadsheet column, decide which target field (if any) it maps to.
Rules:
- A target field can be used at most once. Pick the BEST column for each field.
- If a column doesn't clearly match any target field, map it to null.
- Use both the column header AND the sample values to decide.
- Be tolerant of messy headers ("Donor", "Contributor Name", "First Name+Last Name combos", etc.).
- If first name and last name appear as separate columns and the schema has a single "name" field, map ONLY the column that best represents the full name (or first name if no full-name column exists). Note this in "notes".
- For date fields, accept any date-like column.
- For amount/number fields, accept columns whose sample values look numeric (with $, commas, etc.).

Respond with strict JSON in this exact shape:
{
  "mapping": { "<column header>": "<target field key or null>", ... },
  "notes": "<one short sentence describing any ambiguity, ignored columns, or things the user should double-check>"
}`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 2048,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "You map spreadsheet columns to a target schema. Always respond with valid JSON matching the requested shape." },
        { role: "user", content: prompt },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    let parsed: { mapping?: Record<string, string | null>; notes?: string };
    try {
      parsed = JSON.parse(raw);
    } catch {
      res.status(502).json({ error: "AI returned non-JSON response", raw });
      return;
    }

    const validKeys = new Set(targetFields.map(f => f.key));
    const cleanMapping: Record<string, string | null> = {};
    const usedFields = new Set<string>();
    for (const header of headers) {
      const suggested = parsed.mapping?.[header];
      if (typeof suggested === "string" && validKeys.has(suggested) && !usedFields.has(suggested)) {
        cleanMapping[header] = suggested;
        usedFields.add(suggested);
      } else {
        cleanMapping[header] = null;
      }
    }

    res.json({
      mapping: cleanMapping,
      notes: typeof parsed.notes === "string" ? parsed.notes : "",
    });
  } catch (err) {
    req.log.error({ err }, "AI mapping failed");
    const msg = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: `AI mapping failed: ${msg}` });
  }
});

export default router;
