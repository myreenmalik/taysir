import { useState, useMemo, useRef, useEffect } from "react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Upload, AlertCircle, CheckCircle2, RotateCcw, Sparkles, Trash2 } from "lucide-react";

const API_BASE = `${import.meta.env.BASE_URL}api`.replace(/\/+/g, "/");

type Entity = "donors" | "donations" | "events" | "revenue";

type FieldDef = { key: string; label: string; required: boolean; type: string };

type Mapping = {
  // For each spreadsheet column header, where it maps. null = ignore.
  // "notes" is special: append "<header>: <value>" to a notes field on a chosen entity.
  [header: string]:
    | { kind: "field"; entity: Entity; field: string; confidence: string; reason: string; source: "ai" | "saved" | "user" }
    | { kind: "notes"; entity: Entity; source: "user" }
    | { kind: "combine"; entity: Entity; field: string; with: string[]; separator: string; source: "user" }
    | null;
};

type AnalyzeResult = {
  entitiesPresent: { entity: Entity; estimatedCount: number; confidence: string; reason: string }[];
  mapping: Mapping;
  notes: string;
  schema: Record<Entity, FieldDef[]>;
};

type ParsedFile = {
  fileName: string;
  sheetNames: string[];
  activeSheet: string;
  headers: string[];
  rows: Record<string, unknown>[];
};

type Step = "upload" | "configure" | "review" | "summary";

type DuplicateCandidate = { id: number; name: string; email: string | null; totalDonated: string; donationCount: number; matchedOn: string };
type DuplicateMatch = { index: number; candidates: DuplicateCandidate[]; suggestion: string };
type DonorAction = { action: "create" | "merge" | "skip"; mergeWith?: number };

const ENTITY_LABEL: Record<Entity, string> = {
  donors: "Donors",
  donations: "Donations",
  events: "Events",
  revenue: "Event Revenue",
};

const ENTITY_ORDER: Entity[] = ["donors", "donations", "events", "revenue"];

function normHeader(h: string) { return h.trim().toLowerCase().replace(/\s+/g, " "); }

function readSheetAsRows(sheet: XLSX.WorkSheet): { headers: string[]; rows: Record<string, unknown>[] } {
  // Read as 2D array first, find best header row (first non-mostly-empty row), then derive records.
  const arr = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw: false });
  if (arr.length === 0) return { headers: [], rows: [] };

  // Find header row: first row where >= 2 cells are non-empty short strings.
  let headerIdx = 0;
  for (let i = 0; i < Math.min(arr.length, 10); i++) {
    const row = arr[i] || [];
    const nonEmpty = row.filter(c => c != null && String(c).trim() !== "");
    if (nonEmpty.length >= 2 && nonEmpty.every(c => String(c).length < 60)) {
      headerIdx = i;
      break;
    }
  }
  const headerRow = (arr[headerIdx] || []).map((c, i) => {
    const s = c == null ? "" : String(c).trim();
    return s || `Column ${i + 1}`;
  });
  // Dedupe header names.
  const seen = new Map<string, number>();
  const headers = headerRow.map(h => {
    const n = seen.get(h) ?? 0;
    seen.set(h, n + 1);
    return n === 0 ? h : `${h} (${n + 1})`;
  });

  const rows: Record<string, unknown>[] = [];
  for (let i = headerIdx + 1; i < arr.length; i++) {
    const r = arr[i] || [];
    const allEmpty = r.every(c => c == null || String(c).trim() === "");
    if (allEmpty) continue;
    const obj: Record<string, unknown> = {};
    headers.forEach((h, j) => { obj[h] = r[j] ?? ""; });
    rows.push(obj);
  }
  return { headers, rows };
}

function parseAmount(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const cleaned = v.replace(/[$,\s]/g, "");
    if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
    const n = parseFloat(cleaned);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function normalizeDateMaybe(v: unknown): string | null {
  if (v == null || v === "") return null;
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return null;
    return v.toISOString().split("T")[0];
  }
  if (typeof v === "string") {
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) return d.toISOString().split("T")[0];
  }
  return null;
}

function trimOrNull(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s || null;
}

export default function ImportData() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>("upload");
  const [parsedFile, setParsedFile] = useState<ParsedFile | null>(null);
  const [parsedWorkbook, setParsedWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [analyze, setAnalyze] = useState<AnalyzeResult | null>(null);
  const [selectedEntities, setSelectedEntities] = useState<Set<Entity>>(new Set());
  const [mapping, setMapping] = useState<Mapping>({});

  const [duplicateMatches, setDuplicateMatches] = useState<DuplicateMatch[]>([]);
  const [donorActions, setDonorActions] = useState<Record<number, DonorAction>>({});
  const [committing, setCommitting] = useState(false);
  const [commitError, setCommitError] = useState<string | null>(null);
  const [commitSummary, setCommitSummary] = useState<{
    summary: Record<string, number>;
    donorResults: { index: number; status: string; donorId: number | null; donationId: number | null; reason: string | null }[];
    eventResults: { index: number; status: string; eventId: number | null; reason: string | null }[];
    revenueResults: { index: number; status: string; revenueId: number | null; reason: string | null }[];
  } | null>(null);

  const reset = () => {
    setStep("upload");
    setParsedFile(null);
    setParsedWorkbook(null);
    setParseError(null);
    setAnalyze(null);
    setAnalyzeError(null);
    setSelectedEntities(new Set());
    setMapping({});
    setDuplicateMatches([]);
    setDonorActions({});
    setCommitError(null);
    setCommitSummary(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFile = async (file: File) => {
    setParseError(null);
    const ext = file.name.split(".").pop()?.toLowerCase();
    try {
      if (ext === "csv") {
        await new Promise<void>((resolve, reject) => {
          Papa.parse<Record<string, unknown>>(file, {
            header: true,
            skipEmptyLines: true,
            complete: (result) => {
              const headers = (result.meta.fields ?? []).filter(h => h && String(h).trim());
              const rows = result.data.filter(r => Object.values(r).some(v => v !== null && v !== undefined && v !== ""));
              if (headers.length === 0 || rows.length === 0) {
                setParseError("The file appears to be empty or has no headers.");
                resolve();
                return;
              }
              setParsedFile({ fileName: file.name, sheetNames: ["Sheet1"], activeSheet: "Sheet1", headers, rows });
              setParsedWorkbook(null);
              resolve();
            },
            error: (err) => reject(err),
          });
        });
      } else if (ext === "xlsx" || ext === "xls") {
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: "array", cellDates: true });
        if (wb.SheetNames.length === 0) {
          setParseError("Workbook has no sheets.");
          return;
        }
        // Prefer the first non-empty sheet so workbooks with cover/notes tabs first still work.
        let chosenName = wb.SheetNames[0];
        let chosenParsed = readSheetAsRows(wb.Sheets[chosenName]);
        for (const name of wb.SheetNames) {
          const p = readSheetAsRows(wb.Sheets[name]);
          if (p.headers.length > 0 && p.rows.length > 0) {
            chosenName = name;
            chosenParsed = p;
            break;
          }
        }
        if (chosenParsed.headers.length === 0 || chosenParsed.rows.length === 0) {
          setParseError(`No sheet in "${file.name}" has any data. Try a different file.`);
          // Still expose the workbook so the user can pick a sheet manually if they want.
        }
        setParsedFile({ fileName: file.name, sheetNames: wb.SheetNames, activeSheet: chosenName, headers: chosenParsed.headers, rows: chosenParsed.rows });
        setParsedWorkbook(wb);
        // Move to configure step regardless — sheet picker lives there, and analyze auto-runs.
        if (chosenParsed.headers.length > 0 && chosenParsed.rows.length > 0) {
          setStep("configure");
        }
      } else {
        setParseError("Unsupported file type. Please upload a .csv or .xlsx file.");
        return;
      }
    } catch (err) {
      setParseError(err instanceof Error ? err.message : "Failed to parse file");
    }
  };

  // When a sheet is changed in an XLSX, re-derive headers+rows.
  const switchSheet = (name: string) => {
    if (!parsedWorkbook || !parsedFile) return;
    const sheet = parsedWorkbook.Sheets[name];
    if (!sheet) return;
    const { headers, rows } = readSheetAsRows(sheet);
    setParsedFile({ ...parsedFile, activeSheet: name, headers, rows });
    setAnalyze(null);
    setMapping({});
    setSelectedEntities(new Set());
  };

  // Auto-run analyze whenever a fresh file is parsed (or sheet switched).
  useEffect(() => {
    if (!parsedFile || analyze) return;
    if (parsedFile.headers.length === 0 || parsedFile.rows.length === 0) return;
    void runAnalyze();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parsedFile?.fileName, parsedFile?.activeSheet]);

  const runAnalyze = async () => {
    if (!parsedFile) return;
    setAnalyzing(true);
    setAnalyzeError(null);
    try {
      const res = await fetch(`${API_BASE}/import/analyze-sheet`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          headers: parsedFile.headers,
          sampleRows: parsedFile.rows.slice(0, 8),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAnalyzeError(data.error ?? "Analysis failed");
        return;
      }
      const result: AnalyzeResult = {
        entitiesPresent: data.entitiesPresent ?? [],
        mapping: data.mapping ?? {},
        notes: data.notes ?? "",
        schema: data.schema ?? { donors: [], donations: [], events: [] },
      };
      setAnalyze(result);
      // Auto-select detected entity types with non-zero count.
      const sel = new Set<Entity>();
      for (const e of result.entitiesPresent) {
        if (e.estimatedCount > 0) sel.add(e.entity);
      }
      // Convert mapping into our internal shape (it already arrives in `kind:'field'` shape but as a plain object).
      const m: Mapping = {};
      for (const h of parsedFile.headers) {
        const v = (data.mapping ?? {})[h];
        if (v && typeof v === "object" && v.entity && v.field) {
          m[h] = { kind: "field", entity: v.entity, field: v.field, confidence: v.confidence ?? "medium", reason: v.reason ?? "", source: v.source ?? "ai" };
        } else {
          m[h] = null;
        }
      }
      setMapping(m);
      setSelectedEntities(sel);
      setStep("configure");
    } catch (err) {
      setAnalyzeError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setAnalyzing(false);
    }
  };

  // Update one column's mapping. If user picks a target already used elsewhere, clear it from the other column.
  const updateMapping = (header: string, value: Mapping[string]) => {
    setMapping(prev => {
      const next = { ...prev };
      if (value && (value.kind === "field" || value.kind === "combine")) {
        const conflictKey = `${value.entity}.${value.field}`;
        for (const k of Object.keys(next)) {
          const v = next[k];
          if (k !== header && v && (v.kind === "field" || v.kind === "combine") && `${v.entity}.${v.field}` === conflictKey) {
            next[k] = null;
          }
        }
      }
      next[header] = value;
      return next;
    });
  };

  const ignoreEmptyColumns = () => {
    if (!parsedFile) return;
    setMapping(prev => {
      const next = { ...prev };
      for (const h of parsedFile.headers) {
        const allEmpty = parsedFile.rows.every(r => {
          const v = r[h];
          return v == null || String(v).trim() === "";
        });
        if (allEmpty) next[h] = null;
      }
      return next;
    });
  };

  const sampleValuesFor = (header: string): string[] => {
    if (!parsedFile) return [];
    const out: string[] = [];
    for (const row of parsedFile.rows) {
      const v = row[header];
      if (v != null && String(v).trim() !== "") out.push(String(v).trim());
      if (out.length >= 3) break;
    }
    return out;
  };

  // Required-fields validation: for each selected entity, check that all required fields have a column mapped.
  const requiredMissing = useMemo(() => {
    if (!analyze) return [] as { entity: Entity; field: string; label: string }[];
    const missing: { entity: Entity; field: string; label: string }[] = [];
    const targets = new Set<string>();
    for (const v of Object.values(mapping)) {
      if (v && (v.kind === "field" || v.kind === "combine")) targets.add(`${v.entity}.${v.field}`);
    }
    for (const e of selectedEntities) {
      for (const f of analyze.schema[e] ?? []) {
        if (f.required && !targets.has(`${e}.${f.key}`)) {
          missing.push({ entity: e, field: f.key, label: f.label });
        }
      }
    }
    return missing;
  }, [mapping, selectedEntities, analyze]);

  // Build per-entity record arrays from the mapped rows.
  function buildEntityRecords(): { donors: Record<string, unknown>[]; events: Record<string, unknown>[]; revenue: Record<string, unknown>[] } {
    const donors: Record<string, unknown>[] = [];
    const events: Record<string, unknown>[] = [];
    if (!parsedFile) return { donors, events, revenue: [] as Record<string, unknown>[] };

    // Group columns by entity.
    const colsByEntity: Record<Entity, { header: string; field: string }[]> = { donors: [], donations: [], events: [], revenue: [] };
    const notesCols: Record<Entity, string[]> = { donors: [], donations: [], events: [], revenue: [] };
    const revenue: Record<string, unknown>[] = [];
    const combineCols: { header: string; entity: Entity; field: string; with: string[]; separator: string }[] = [];

    for (const [header, m] of Object.entries(mapping)) {
      if (!m) continue;
      if (m.kind === "field") colsByEntity[m.entity].push({ header, field: m.field });
      else if (m.kind === "notes") notesCols[m.entity].push(header);
      else if (m.kind === "combine") combineCols.push({ header, entity: m.entity, field: m.field, with: m.with, separator: m.separator });
    }

    for (const row of parsedFile.rows) {
      // Build donor from this row (if selected).
      if (selectedEntities.has("donors")) {
        const donorRec: Record<string, unknown> = {};
        for (const c of colsByEntity.donors) donorRec[c.field] = row[c.header];
        // Donations data is colocated on the same row — flatten amount/date/etc into the donor record so ai-commit creates donor + donation per row.
        if (selectedEntities.has("donations")) {
          for (const c of colsByEntity.donations) donorRec[c.field] = row[c.header];
        }
        // Notes catch-all for donors.
        const noteParts: string[] = [];
        for (const h of notesCols.donors) {
          const v = row[h]; if (v != null && String(v).trim() !== "") noteParts.push(`${h}: ${String(v).trim()}`);
        }
        if (selectedEntities.has("donations")) {
          for (const h of notesCols.donations) {
            const v = row[h]; if (v != null && String(v).trim() !== "") noteParts.push(`${h}: ${String(v).trim()}`);
          }
        }
        const existingNotes = donorRec.notes ? String(donorRec.notes).trim() : "";
        donorRec.notes = [existingNotes, noteParts.join(" | ")].filter(Boolean).join(" | ") || null;
        // Combines
        for (const cc of combineCols.filter(c => c.entity === "donors" || (c.entity === "donations" && selectedEntities.has("donations")))) {
          const parts = [cc.header, ...cc.with].map(h => row[h]).filter(v => v != null && String(v).trim() !== "").map(v => String(v).trim());
          if (parts.length > 0) donorRec[cc.field] = parts.join(cc.separator);
        }
        // Skip if no name OR no donation amount (purely empty row).
        if (donorRec.name && String(donorRec.name).trim()) {
          donors.push(donorRec);
        }
      }

      // Build event records from rows (only if events entity selected — typical for an events sheet).
      if (selectedEntities.has("events")) {
        const eventRec: Record<string, unknown> = {};
        for (const c of colsByEntity.events) eventRec[c.field] = row[c.header];
        const noteParts: string[] = [];
        for (const h of notesCols.events) {
          const v = row[h]; if (v != null && String(v).trim() !== "") noteParts.push(`${h}: ${String(v).trim()}`);
        }
        const existingNotes = eventRec.notes ? String(eventRec.notes).trim() : "";
        eventRec.notes = [existingNotes, noteParts.join(" | ")].filter(Boolean).join(" | ") || null;
        for (const cc of combineCols.filter(c => c.entity === "events")) {
          const parts = [cc.header, ...cc.with].map(h => row[h]).filter(v => v != null && String(v).trim() !== "").map(v => String(v).trim());
          if (parts.length > 0) eventRec[cc.field] = parts.join(cc.separator);
        }
        if (eventRec.name && String(eventRec.name).trim()) {
          events.push(eventRec);
        }
      }
    }

    // Build revenue records (one per row) when revenue entity selected.
    if (selectedEntities.has("revenue")) {
      for (const row of parsedFile.rows) {
        const rec: Record<string, unknown> = {};
        for (const c of colsByEntity.revenue) rec[c.field] = row[c.header];
        const noteParts: string[] = [];
        for (const h of notesCols.revenue) {
          const v = row[h]; if (v != null && String(v).trim() !== "") noteParts.push(`${h}: ${String(v).trim()}`);
        }
        const existingNotes = rec.notes ? String(rec.notes).trim() : "";
        rec.notes = [existingNotes, noteParts.join(" | ")].filter(Boolean).join(" | ") || null;
        for (const cc of combineCols.filter(c => c.entity === "revenue")) {
          const parts = [cc.header, ...cc.with].map(h => row[h]).filter(v => v != null && String(v).trim() !== "").map(v => String(v).trim());
          if (parts.length > 0) rec[cc.field] = parts.join(cc.separator);
        }
        if (rec.amount != null && String(rec.amount).trim() !== "") revenue.push(rec);
      }
    }

    return { donors, events, revenue };
  }

  const proceedToReview = async () => {
    if (!parsedFile) return;
    if (requiredMissing.length > 0) return;
    // Save user-changed mappings (any "user" source) so they're remembered.
    try {
      const corrections = Object.entries(mapping)
        .filter(([, v]) => v && (v.kind === "field") && (v as { source?: string }).source === "user")
        .map(([header, v]) => {
          const f = v as { entity: string; field: string };
          return { header, entity: f.entity, field: f.field };
        });
      if (corrections.length > 0) {
        await fetch(`${API_BASE}/import/mapping-corrections`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ corrections }),
        }).catch(() => {});
      }
    } catch { /* non-fatal */ }

    const { donors } = buildEntityRecords();

    // Run duplicate preview if donors are present.
    if (donors.length > 0) {
      try {
        const res = await fetch(`${API_BASE}/import/ai-preview-duplicates`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ donors: donors.map(d => ({ name: d.name, email: d.email })) }),
        });
        const data = await res.json();
        if (res.ok && Array.isArray(data.matches)) {
          setDuplicateMatches(data.matches);
          const init: Record<number, DonorAction> = {};
          for (const m of data.matches as DuplicateMatch[]) {
            if (m.candidates.length > 0) init[m.index] = { action: "merge", mergeWith: m.candidates[0].id };
            else init[m.index] = { action: "create" };
          }
          setDonorActions(init);
        }
      } catch { /* non-fatal */ }
    }
    setStep("review");
  };

  const runCommit = async () => {
    if (!parsedFile) return;
    setCommitting(true);
    setCommitError(null);
    try {
      const { donors, events } = buildEntityRecords();
      const donorActionsArr = Object.entries(donorActions).map(([idx, a]) => ({ index: parseInt(idx, 10), action: a.action, mergeWith: a.mergeWith }));
      const res = await fetch(`${API_BASE}/import/ai-commit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ donors, events, revenue: [], donorActions: donorActionsArr }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCommitError(data.error ?? "Commit failed");
        return;
      }
      setCommitSummary(data);
      setStep("summary");
      void queryClient.invalidateQueries();
    } catch (err) {
      setCommitError(err instanceof Error ? err.message : "Commit failed");
    } finally {
      setCommitting(false);
    }
  };

  const builtRecords = useMemo(() => buildEntityRecords(), [mapping, parsedFile, selectedEntities]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Import Data</h1>
        <p className="text-muted-foreground mt-1">
          Upload any spreadsheet — donors, donations, events, or a mix. The system reads it, figures out what's where, and walks you through the rest.
        </p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 text-sm">
        {(["upload", "configure", "review", "summary"] as Step[]).map((s, i) => {
          const stepLabels = { upload: "Upload", configure: "Detect & map", review: "Review", summary: "Done" };
          return (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${
                step === s ? "bg-primary text-primary-foreground" : (["upload", "configure", "review", "summary"] as Step[]).indexOf(step) > i ? "bg-primary/30 text-primary" : "bg-muted text-muted-foreground"
              }`}>{i + 1}</div>
              <span className={step === s ? "font-semibold" : "text-muted-foreground"}>{stepLabels[s]}</span>
              {i < 3 && <div className="w-8 h-px bg-border" />}
            </div>
          );
        })}
      </div>

      {parseError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{parseError}</AlertDescription>
        </Alert>
      )}

      {/* Analyze error banner — visible on upload step too so users see transient AI failures */}
      {step === "upload" && analyzeError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Analysis failed</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-4">
            <span>{analyzeError}</span>
            {parsedFile && (
              <Button size="sm" variant="outline" onClick={() => void runAnalyze()}>Retry</Button>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* STEP 1: Upload */}
      {step === "upload" && (
        <Card>
          <CardHeader>
            <CardTitle>Upload your spreadsheet</CardTitle>
            <CardDescription>CSV or Excel. No need to pre-classify the data — the system will detect what's inside.</CardDescription>
          </CardHeader>
          <CardContent>
            <div
              className="border-2 border-dashed rounded-lg p-12 text-center hover:border-primary/50 transition-colors cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files?.[0];
                if (file) void handleFile(file);
              }}
            >
              <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm font-medium">Click to upload or drag and drop</p>
              <p className="text-xs text-muted-foreground mt-1">CSV or Excel (.xlsx) files</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f); }}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* STEP 2: Configure (auto-detect + mapping) */}
      {step === "configure" && parsedFile && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                    What's in this file
                  </CardTitle>
                  <CardDescription>{parsedFile.fileName}{parsedFile.sheetNames.length > 1 ? ` — sheet "${parsedFile.activeSheet}"` : ""}</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={reset}>
                  <RotateCcw className="h-4 w-4 mr-1" /> Start over
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Sheet picker for multi-sheet workbooks */}
              {parsedFile.sheetNames.length > 1 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <Label className="text-sm">Sheet:</Label>
                  {parsedFile.sheetNames.map(n => (
                    <button
                      key={n}
                      type="button"
                      className={`px-2.5 py-1 text-xs rounded border ${n === parsedFile.activeSheet ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted"}`}
                      onClick={() => switchSheet(n)}
                    >{n}</button>
                  ))}
                </div>
              )}

              {analyzing && (
                <div className="text-sm text-muted-foreground flex items-center gap-2">
                  <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
                  Analyzing the file...
                </div>
              )}
              {analyzeError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Analysis failed</AlertTitle>
                  <AlertDescription>{analyzeError}</AlertDescription>
                </Alert>
              )}

              {analyze && (
                <>
                  {/* Detection summary */}
                  <div>
                    <p className="text-sm font-semibold mb-2">We found:</p>
                    <div className="space-y-2">
                      {analyze.entitiesPresent.length === 0 && (
                        <p className="text-sm text-muted-foreground">No recognizable entities detected. You can still pick which entities to import below.</p>
                      )}
                      {ENTITY_ORDER.map(ent => {
                        const detected = analyze.entitiesPresent.find(e => e.entity === ent);
                        const count = detected?.estimatedCount ?? 0;
                        const conf = detected?.confidence ?? "low";
                        const checked = selectedEntities.has(ent);
                        return (
                          <label key={ent} className={`flex items-center gap-3 p-2 border rounded cursor-pointer ${checked ? "border-primary bg-primary/5" : ""}`}>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                setSelectedEntities(prev => {
                                  const next = new Set(prev);
                                  if (e.target.checked) next.add(ent); else next.delete(ent);
                                  return next;
                                });
                              }}
                            />
                            <span className="text-sm font-medium">{ENTITY_LABEL[ent]}</span>
                            {detected ? (
                              <span className="text-xs text-muted-foreground">~{count} {count === 1 ? "row" : "rows"}</span>
                            ) : (
                              <span className="text-xs text-muted-foreground">not detected</span>
                            )}
                            {detected && (
                              <span className={`text-[10px] px-1.5 py-0.5 rounded ${conf === "high" ? "bg-green-100 text-green-700" : conf === "medium" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-800"}`}>{conf}</span>
                            )}
                          </label>
                        );
                      })}
                    </div>
                    {analyze.notes && (
                      <p className="text-xs text-muted-foreground mt-2 italic">{analyze.notes}</p>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Mapping table */}
          {analyze && selectedEntities.size > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle>Map your columns</CardTitle>
                    <CardDescription>
                      For each spreadsheet column, choose what it represents. Required fields are highlighted below.
                    </CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={ignoreEmptyColumns}>
                    <Trash2 className="h-4 w-4 mr-1" /> Ignore empty columns
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {requiredMissing.length > 0 && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Required fields not yet mapped</AlertTitle>
                    <AlertDescription>
                      {requiredMissing.map((m, i) => (
                        <span key={i} className="inline-block mr-2 text-xs">
                          <Badge variant="outline" className="border-destructive text-destructive">{ENTITY_LABEL[m.entity]} → {m.label}</Badge>
                        </span>
                      ))}
                    </AlertDescription>
                  </Alert>
                )}

                <div className="border rounded overflow-auto max-h-[600px]">
                  <table className="w-full text-sm">
                    <thead className="bg-muted sticky top-0 z-10">
                      <tr>
                        <th className="text-left p-2 font-medium">Spreadsheet column</th>
                        <th className="text-left p-2 font-medium">Sample values</th>
                        <th className="text-left p-2 font-medium">Maps to</th>
                        <th className="text-left p-2 font-medium">Confidence</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsedFile.headers.map((header) => {
                        const m = mapping[header];
                        const samples = sampleValuesFor(header);
                        const value =
                          !m ? "__none__" :
                          m.kind === "field" ? `field:${m.entity}.${m.field}` :
                          m.kind === "notes" ? `notes:${m.entity}` :
                          `field:${m.entity}.${m.field}`;
                        const conf = m && m.kind === "field" ? m.confidence : null;
                        const isRequiredAndMissing = m == null && requiredMissing.some(rm => false); // not used per-row; alert covers it
                        const reason = m && m.kind === "field" ? m.reason : null;
                        const isSaved = m && m.kind === "field" && m.source === "saved";
                        return (
                          <tr key={header} className={`border-t ${isRequiredAndMissing ? "bg-destructive/10" : ""}`}>
                            <td className="p-2 font-medium align-top">{header}</td>
                            <td className="p-2 text-xs text-muted-foreground align-top">
                              {samples.length > 0 ? samples.map((s, i) => (
                                <div key={i} className="truncate max-w-[240px]">{s}</div>
                              )) : <span className="italic">(empty)</span>}
                            </td>
                            <td className="p-2 align-top">
                              <select
                                className="text-xs border rounded px-2 py-1 bg-background w-full max-w-[260px]"
                                value={value}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  if (v === "__none__") return updateMapping(header, null);
                                  if (v.startsWith("notes:")) {
                                    const ent = v.slice(6) as Entity;
                                    return updateMapping(header, { kind: "notes", entity: ent, source: "user" });
                                  }
                                  if (v.startsWith("field:")) {
                                    const [ent, field] = v.slice(6).split(".");
                                    return updateMapping(header, { kind: "field", entity: ent as Entity, field, confidence: "high", reason: "User chose", source: "user" });
                                  }
                                }}
                              >
                                <option value="__none__">— Ignore this column —</option>
                                {ENTITY_ORDER.filter(e => selectedEntities.has(e)).map(ent => (
                                  <optgroup key={ent} label={ENTITY_LABEL[ent]}>
                                    {(analyze.schema[ent] ?? []).map(f => (
                                      <option key={`${ent}.${f.key}`} value={`field:${ent}.${f.key}`}>
                                        {f.label}{f.required ? " *" : ""}
                                      </option>
                                    ))}
                                    <option value={`notes:${ent}`}>↳ Append to {ENTITY_LABEL[ent]} notes</option>
                                  </optgroup>
                                ))}
                              </select>
                              {reason && (
                                <p className="text-[10px] text-muted-foreground mt-1 italic max-w-[260px]">{reason}</p>
                              )}
                              {/* Combine helper: when this column maps to a field, let the user merge other ignored columns into the same target. */}
                              {m && (m.kind === "field" || m.kind === "combine") && (() => {
                                const ignoredOthers = parsedFile.headers.filter(h => h !== header && mapping[h] == null);
                                const currentWith = m.kind === "combine" ? m.with : [];
                                const sep = m.kind === "combine" ? m.separator : " ";
                                if (ignoredOthers.length === 0 && currentWith.length === 0) return null;
                                return (
                                  <div className="mt-1 space-y-1">
                                    <details className="text-[10px] text-muted-foreground">
                                      <summary className="cursor-pointer hover:text-foreground">
                                        + Combine with other columns {currentWith.length > 0 ? `(${currentWith.length})` : ""}
                                      </summary>
                                      <div className="mt-1 p-2 border rounded bg-muted/30 space-y-1 max-w-[260px]">
                                        <label className="flex items-center gap-1 text-[10px]">
                                          <span>Separator:</span>
                                          <input
                                            type="text"
                                            className="border rounded px-1 py-0.5 w-12 text-[10px]"
                                            value={sep}
                                            onChange={(e) => {
                                              const newSep = e.target.value || " ";
                                              const ent = m.entity;
                                              const fld = m.field;
                                              const w = m.kind === "combine" ? m.with : [];
                                              if (w.length === 0) return;
                                              updateMapping(header, { kind: "combine", entity: ent, field: fld, with: w, separator: newSep, source: "user" });
                                            }}
                                          />
                                        </label>
                                        {[...currentWith, ...ignoredOthers].map(other => {
                                          const checked = currentWith.includes(other);
                                          return (
                                            <label key={other} className="flex items-center gap-1 text-[10px] cursor-pointer">
                                              <input
                                                type="checkbox"
                                                checked={checked}
                                                onChange={(e) => {
                                                  const ent = m.entity;
                                                  const fld = m.field;
                                                  const next = e.target.checked
                                                    ? [...currentWith, other]
                                                    : currentWith.filter(h => h !== other);
                                                  if (next.length === 0) {
                                                    // Demote back to plain field mapping.
                                                    updateMapping(header, { kind: "field", entity: ent, field: fld, confidence: "high", reason: "User chose", source: "user" });
                                                  } else {
                                                    updateMapping(header, { kind: "combine", entity: ent, field: fld, with: next, separator: sep, source: "user" });
                                                  }
                                                }}
                                              />
                                              <span className="truncate">{other}</span>
                                            </label>
                                          );
                                        })}
                                      </div>
                                    </details>
                                  </div>
                                );
                              })()}
                            </td>
                            <td className="p-2 align-top">
                              {isSaved && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-700">saved</span>
                              )}
                              {!isSaved && conf && (
                                <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                                  conf === "high" ? "bg-green-100 text-green-700" :
                                  conf === "medium" ? "bg-blue-100 text-blue-700" :
                                  "bg-amber-100 text-amber-800"
                                }`}>{conf}</span>
                              )}
                              {m && m.kind === "notes" && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">notes</span>
                              )}
                              {!m && (
                                <span className="text-[10px] text-muted-foreground italic">ignored</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="flex items-center justify-between">
                  <div className="text-xs text-muted-foreground">
                    {parsedFile.rows.length} row{parsedFile.rows.length === 1 ? "" : "s"} ready · {builtRecords.donors.length} donor{builtRecords.donors.length === 1 ? "" : "s"} + {builtRecords.events.length} event{builtRecords.events.length === 1 ? "" : "s"} will be created
                  </div>
                  <Button onClick={proceedToReview} disabled={requiredMissing.length > 0 || (builtRecords.donors.length === 0 && builtRecords.events.length === 0)}>
                    Continue to review
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* STEP 3: Review (duplicates) */}
      {step === "review" && parsedFile && analyze && (
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle>Review before importing</CardTitle>
                <CardDescription>
                  We checked your donors against existing records. Confirm the suggested actions or adjust them.
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => setStep("configure")}>Back</Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {commitError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Commit failed</AlertTitle>
                <AlertDescription>{commitError}</AlertDescription>
              </Alert>
            )}

            {builtRecords.donors.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-semibold">Donors ({builtRecords.donors.length})</p>
                <div className="border rounded bg-background overflow-auto max-h-96">
                  <table className="w-full text-xs">
                    <thead className="bg-muted sticky top-0">
                      <tr>
                        <th className="text-left p-2 font-medium">Name</th>
                        <th className="text-left p-2 font-medium">Email</th>
                        <th className="text-left p-2 font-medium">Amount</th>
                        <th className="text-left p-2 font-medium">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {builtRecords.donors.map((d, i) => {
                        const dup = duplicateMatches.find(m => m.index === i);
                        const action = donorActions[i] ?? { action: "create" as const };
                        return (
                          <tr key={i} className="border-t">
                            <td className="p-2">{String(d.name ?? "")}</td>
                            <td className="p-2 text-muted-foreground">{d.email ? String(d.email) : ""}</td>
                            <td className="p-2">{d.amount != null ? `$${String(d.amount)}` : ""}</td>
                            <td className="p-2">
                              {dup && dup.candidates.length > 0 ? (
                                <select
                                  className="text-xs border rounded px-1 py-0.5 bg-background"
                                  value={action.action === "merge" ? `merge:${action.mergeWith}` : action.action}
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    if (v.startsWith("merge:")) setDonorActions(p => ({ ...p, [i]: { action: "merge", mergeWith: parseInt(v.slice(6), 10) } }));
                                    else if (v === "create") setDonorActions(p => ({ ...p, [i]: { action: "create" } }));
                                    else setDonorActions(p => ({ ...p, [i]: { action: "skip" } }));
                                  }}
                                >
                                  {dup.candidates.map(c => (
                                    <option key={c.id} value={`merge:${c.id}`}>Merge → {c.name}{c.email ? ` (${c.email})` : ""}</option>
                                  ))}
                                  <option value="create">Create new</option>
                                  <option value="skip">Skip</option>
                                </select>
                              ) : (
                                <select
                                  className="text-xs border rounded px-1 py-0.5 bg-background"
                                  value={action.action}
                                  onChange={(e) => setDonorActions(p => ({ ...p, [i]: { action: e.target.value as "create" | "skip" } }))}
                                >
                                  <option value="create">Create</option>
                                  <option value="skip">Skip</option>
                                </select>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {builtRecords.events.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-semibold">Events ({builtRecords.events.length})</p>
                <div className="border rounded bg-background overflow-auto max-h-48">
                  <table className="w-full text-xs">
                    <thead className="bg-muted sticky top-0">
                      <tr>
                        {["name", "date", "location", "eventType", "campaign"].map(h => (
                          <th key={h} className="text-left p-2 font-medium">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {builtRecords.events.map((r, i) => (
                        <tr key={i} className="border-t">
                          {["name", "date", "location", "eventType", "campaign"].map(h => (
                            <td key={h} className="p-2 truncate max-w-[180px]">{r[h] != null ? String(r[h]) : ""}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <Button onClick={runCommit} disabled={committing}>
                {committing ? "Importing..." : "Import now"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* STEP 4: Summary */}
      {step === "summary" && commitSummary && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              Import complete
            </CardTitle>
            <CardDescription>Your dashboard has been updated.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="border rounded p-3">
                <div className="text-xs text-muted-foreground">Donors created</div>
                <div className="text-2xl font-semibold">{commitSummary.summary.donorsImported ?? 0}</div>
              </div>
              <div className="border rounded p-3">
                <div className="text-xs text-muted-foreground">Donors merged</div>
                <div className="text-2xl font-semibold">{commitSummary.summary.donorsMerged ?? 0}</div>
              </div>
              <div className="border rounded p-3">
                <div className="text-xs text-muted-foreground">Events imported</div>
                <div className="text-2xl font-semibold">{commitSummary.summary.eventsImported ?? 0}</div>
              </div>
              <div className="border rounded p-3">
                <div className="text-xs text-muted-foreground">Failures</div>
                <div className="text-2xl font-semibold">{(commitSummary.summary.donorsFailed ?? 0) + (commitSummary.summary.eventsFailed ?? 0)}</div>
              </div>
            </div>

            {((commitSummary.donorResults?.filter(r => r.status === "failed") ?? []).length > 0 ||
              (commitSummary.eventResults?.filter(r => r.status === "failed") ?? []).length > 0) && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Some rows could not be imported</AlertTitle>
                <AlertDescription>
                  <div className="space-y-1 text-xs mt-2">
                    {[...(commitSummary.donorResults ?? []), ...(commitSummary.eventResults ?? [])]
                      .filter(r => r.status === "failed")
                      .slice(0, 10)
                      .map((r, i) => (
                        <div key={i}>Row {r.index + 1}: {r.reason}</div>
                      ))}
                  </div>
                </AlertDescription>
              </Alert>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={reset}>
                <RotateCcw className="h-4 w-4 mr-1" /> Import another file
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

