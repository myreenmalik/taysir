import { useState, useMemo, useRef } from "react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Upload, FileText, AlertCircle, CheckCircle2, XCircle, RotateCcw, Download, Sparkles } from "lucide-react";

type DataType = "donors" | "donations" | "events" | "revenue" | "logistics" | "followups";

type FieldDef = {
  key: string;
  label: string;
  required: boolean;
  type: "string" | "number" | "date" | "integer";
  aliases: string[];
};

const FIELDS: Record<DataType, FieldDef[]> = {
  donors: [
    { key: "name", label: "Name", required: true, type: "string", aliases: ["full name", "donor name", "name"] },
    { key: "email", label: "Email", required: false, type: "string", aliases: ["email", "e-mail", "email address"] },
    { key: "phone", label: "Phone", required: false, type: "string", aliases: ["phone", "phone number", "telephone", "mobile"] },
    { key: "location", label: "Location", required: false, type: "string", aliases: ["location", "city", "address", "city, state"] },
    { key: "donorCategory", label: "Category", required: false, type: "string", aliases: ["category", "donor category", "type"] },
    { key: "donorPersonalityType", label: "Personality Type", required: false, type: "string", aliases: ["personality", "personality type"] },
    { key: "preferredContactFrequency", label: "Preferred Contact Frequency", required: false, type: "string", aliases: ["frequency", "contact frequency"] },
    { key: "notes", label: "Notes", required: false, type: "string", aliases: ["notes", "comments", "memo"] },
  ],
  donations: [
    { key: "donorId", label: "Donor ID", required: true, type: "integer", aliases: ["donor id", "donorid", "donor"] },
    { key: "eventId", label: "Event ID", required: false, type: "integer", aliases: ["event id", "eventid", "event"] },
    { key: "date", label: "Date", required: true, type: "date", aliases: ["date", "donation date", "gift date"] },
    { key: "amount", label: "Amount", required: true, type: "number", aliases: ["amount", "gift amount", "donation amount", "value", "$"] },
    { key: "cause", label: "Cause", required: false, type: "string", aliases: ["cause", "fund", "designation"] },
    { key: "campaign", label: "Campaign", required: false, type: "string", aliases: ["campaign"] },
    { key: "season", label: "Season", required: false, type: "string", aliases: ["season"] },
    { key: "donationType", label: "Donation Type", required: false, type: "string", aliases: ["donation type", "type", "gift type"] },
    { key: "notes", label: "Notes", required: false, type: "string", aliases: ["notes", "comments"] },
  ],
  events: [
    { key: "name", label: "Name", required: true, type: "string", aliases: ["name", "event name", "title"] },
    { key: "date", label: "Date", required: true, type: "date", aliases: ["date", "event date"] },
    { key: "location", label: "Location", required: true, type: "string", aliases: ["location", "venue", "place"] },
    { key: "eventType", label: "Event Type", required: true, type: "string", aliases: ["type", "event type", "category"] },
    { key: "masjidPartner", label: "Masjid Partner", required: false, type: "string", aliases: ["masjid", "masjid partner", "partner"] },
    { key: "campaign", label: "Campaign", required: false, type: "string", aliases: ["campaign"] },
    { key: "organizer", label: "Organizer", required: false, type: "string", aliases: ["organizer", "host", "lead"] },
    { key: "status", label: "Status", required: false, type: "string", aliases: ["status"] },
    { key: "estimatedAttendees", label: "Estimated Attendees", required: false, type: "integer", aliases: ["estimated attendees", "expected", "rsvp count"] },
    { key: "actualAttendees", label: "Actual Attendees", required: false, type: "integer", aliases: ["actual attendees", "attendees", "headcount"] },
    { key: "notes", label: "Notes", required: false, type: "string", aliases: ["notes", "comments"] },
  ],
  revenue: [
    { key: "eventId", label: "Event ID", required: true, type: "integer", aliases: ["event id", "eventid", "event"] },
    { key: "paymentType", label: "Payment Type", required: true, type: "string", aliases: ["payment type", "type", "method"] },
    { key: "amount", label: "Amount", required: true, type: "number", aliases: ["amount", "value", "$"] },
    { key: "quantity", label: "Quantity", required: false, type: "integer", aliases: ["quantity", "qty", "count"] },
    { key: "receivedDate", label: "Received Date", required: false, type: "date", aliases: ["received date", "date received", "date"] },
    { key: "enteredBy", label: "Entered By", required: false, type: "string", aliases: ["entered by", "recorded by"] },
    { key: "notes", label: "Notes", required: false, type: "string", aliases: ["notes", "comments"] },
  ],
  logistics: [
    { key: "eventId", label: "Event ID", required: true, type: "integer", aliases: ["event id", "eventid", "event"] },
    { key: "taskName", label: "Task Name", required: true, type: "string", aliases: ["task", "task name", "name"] },
    { key: "assignedTo", label: "Assigned To", required: false, type: "string", aliases: ["assigned to", "owner", "assignee"] },
    { key: "dueDate", label: "Due Date", required: false, type: "date", aliases: ["due date", "due", "deadline"] },
    { key: "status", label: "Status", required: false, type: "string", aliases: ["status"] },
    { key: "notes", label: "Notes", required: false, type: "string", aliases: ["notes", "comments"] },
  ],
  followups: [
    { key: "taskType", label: "Task Type", required: true, type: "string", aliases: ["task type", "type"] },
    { key: "recommendedAction", label: "Recommended Action", required: true, type: "string", aliases: ["action", "recommended action", "task"] },
    { key: "eventId", label: "Event ID", required: false, type: "integer", aliases: ["event id", "eventid"] },
    { key: "donorId", label: "Donor ID", required: false, type: "integer", aliases: ["donor id", "donorid"] },
    { key: "attendeeId", label: "Attendee ID", required: false, type: "integer", aliases: ["attendee id", "attendeeid"] },
    { key: "status", label: "Status", required: false, type: "string", aliases: ["status"] },
    { key: "dueDate", label: "Due Date", required: false, type: "date", aliases: ["due date", "due"] },
    { key: "notes", label: "Notes", required: false, type: "string", aliases: ["notes", "comments"] },
  ],
};

const DATA_TYPE_LABELS: Record<DataType, string> = {
  donors: "Donors",
  donations: "Donations",
  events: "Events",
  revenue: "Revenue Entries",
  logistics: "Logistics Tasks",
  followups: "Follow-Up Tasks",
};

type ParsedFile = {
  headers: string[];
  rows: Record<string, unknown>[];
  fileName: string;
};

type ImportResult = {
  index: number;
  status: "created" | "updated" | "skipped" | "failed";
  reason: string | null;
  id: number | null;
};

type ImportSummary = {
  total: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
};

type Step = "upload" | "map" | "review" | "summary";

function autoDetectMapping(headers: string[], fields: FieldDef[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  const usedFields = new Set<string>();
  for (const header of headers) {
    const norm = header.toLowerCase().trim();
    for (const field of fields) {
      if (usedFields.has(field.key)) continue;
      if (field.aliases.some(a => a.toLowerCase() === norm) || field.key.toLowerCase() === norm || field.label.toLowerCase() === norm) {
        mapping[header] = field.key;
        usedFields.add(field.key);
        break;
      }
    }
  }
  return mapping;
}

function isValidDate(s: unknown): boolean {
  if (typeof s !== "string" || !s.trim()) {
    if (typeof s === "number") {
      const d = new Date(s);
      return !Number.isNaN(d.getTime());
    }
    return false;
  }
  const d = new Date(s);
  return !Number.isNaN(d.getTime());
}

function parseAmount(v: unknown): number | null {
  // Mirrors the strict server-side parser so a row marked valid in Review
  // won't fail at import time for formatting reasons.
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const cleaned = v.replace(/[$,\s]/g, "");
    if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
    const n = parseFloat(cleaned);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function validateRow(row: Record<string, unknown>, fields: FieldDef[]): string[] {
  const errors: string[] = [];
  for (const field of fields) {
    const v = row[field.key];
    const isEmpty = v == null || v === "" || (typeof v === "string" && !v.trim());
    if (field.required && isEmpty) {
      errors.push(`Missing ${field.label}`);
      continue;
    }
    if (isEmpty) continue;
    if (field.type === "date" && !isValidDate(v)) {
      errors.push(`Invalid date for ${field.label}`);
    } else if (field.type === "number" || field.type === "integer") {
      const n = parseAmount(v);
      if (n == null) errors.push(`Invalid number for ${field.label}`);
      else if (field.type === "integer" && !Number.isInteger(n)) errors.push(`${field.label} must be a whole number`);
    }
  }
  return errors;
}

function downloadCSV(filename: string, rows: Record<string, unknown>[]) {
  if (rows.length === 0) return;
  const csv = Papa.unparse(rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const API_BASE = `${import.meta.env.BASE_URL}api`.replace(/\/+/g, "/");

export default function ImportData() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("upload");
  const [dataType, setDataType] = useState<DataType>("donors");
  const [duplicateStrategy, setDuplicateStrategy] = useState<"skip" | "update" | "create">("skip");
  const [parsedFile, setParsedFile] = useState<ParsedFile | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [importing, setImporting] = useState(false);
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);
  const [importResults, setImportResults] = useState<ImportResult[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [aiMapping, setAiMapping] = useState(false);
  const [aiMappingError, setAiMappingError] = useState<string | null>(null);
  const [aiMappingNotes, setAiMappingNotes] = useState<string | null>(null);

  const fields = FIELDS[dataType];

  const handleFile = async (file: File) => {
    setParseError(null);
    const ext = file.name.split(".").pop()?.toLowerCase();

    try {
      let headers: string[] = [];
      let rows: Record<string, unknown>[] = [];

      if (ext === "csv") {
        await new Promise<void>((resolve, reject) => {
          Papa.parse<Record<string, unknown>>(file, {
            header: true,
            skipEmptyLines: true,
            complete: (result) => {
              headers = (result.meta.fields ?? []).filter(h => h && h.trim());
              rows = result.data.filter(r => Object.values(r).some(v => v !== null && v !== undefined && v !== ""));
              resolve();
            },
            error: (err) => reject(err),
          });
        });
      } else if (ext === "xlsx" || ext === "xls") {
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: "array", cellDates: true });
        const sheetName = wb.SheetNames[0];
        const sheet = wb.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: false });
        if (json.length > 0) {
          headers = Object.keys(json[0]);
          rows = json.filter(r => Object.values(r).some(v => v !== null && v !== undefined && v !== ""));
        }
      } else {
        setParseError("Unsupported file type. Please upload a .csv or .xlsx file.");
        return;
      }

      if (headers.length === 0 || rows.length === 0) {
        setParseError("The file appears to be empty or has no headers.");
        return;
      }

      if (rows.length > MAX_ROWS) {
        setParseError(`This file has ${rows.length} rows. The maximum per import is ${MAX_ROWS}. Please split it into smaller files.`);
        return;
      }

      const detectedMapping = autoDetectMapping(headers, fields);
      setParsedFile({ headers, rows, fileName: file.name });
      setMapping(detectedMapping);
      setStep("map");
    } catch (err) {
      setParseError(err instanceof Error ? err.message : "Failed to parse file");
    }
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void handleFile(file);
  };

  // Re-detect mapping if data type changes after a file is uploaded
  const onDataTypeChange = (val: string) => {
    const newType = val as DataType;
    setDataType(newType);
    if (parsedFile) {
      setMapping(autoDetectMapping(parsedFile.headers, FIELDS[newType]));
    }
  };

  const mappedRows = useMemo(() => {
    if (!parsedFile) return [];
    return parsedFile.rows.map(row => {
      const mapped: Record<string, unknown> = {};
      for (const [header, fieldKey] of Object.entries(mapping)) {
        if (fieldKey && fieldKey !== "__none__") {
          mapped[fieldKey] = row[header];
        }
      }
      return mapped;
    });
  }, [parsedFile, mapping]);

  const validation = useMemo(() => {
    return mappedRows.map((row, idx) => ({ idx, row, errors: validateRow(row, fields) }));
  }, [mappedRows, fields]);

  const validRows = validation.filter(v => v.errors.length === 0);
  const invalidRows = validation.filter(v => v.errors.length > 0);

  const requiredFieldsMapped = useMemo(() => {
    const mappedKeys = new Set(Object.values(mapping).filter(v => v && v !== "__none__"));
    return fields.filter(f => f.required).every(f => mappedKeys.has(f.key));
  }, [mapping, fields]);

  // Detect duplicate field mappings (same target field used by multiple columns)
  const duplicateMappings = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const v of Object.values(mapping)) {
      if (v && v !== "__none__") counts[v] = (counts[v] ?? 0) + 1;
    }
    return Object.entries(counts).filter(([_, n]) => n > 1).map(([k]) => k);
  }, [mapping]);

  const runAiMapping = async () => {
    if (!parsedFile) return;
    setAiMapping(true);
    setAiMappingError(null);
    setAiMappingNotes(null);
    try {
      const res = await fetch(`${API_BASE}/import/suggest-mapping`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dataType,
          headers: parsedFile.headers,
          sampleRows: parsedFile.rows.slice(0, 5),
          targetFields: fields.map(f => ({
            key: f.key,
            label: f.label,
            required: f.required,
            type: f.type,
          })),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || "AI mapping failed");
      }
      const data = await res.json() as { mapping: Record<string, string | null>; notes: string };
      const next: Record<string, string> = {};
      for (const header of parsedFile.headers) {
        const suggested = data.mapping[header];
        next[header] = suggested ?? "__none__";
      }
      setMapping(next);
      setAiMappingNotes(data.notes || null);
    } catch (err) {
      setAiMappingError(err instanceof Error ? err.message : "AI mapping failed");
    } finally {
      setAiMapping(false);
    }
  };

  // When a column is mapped to a target, clear that target from any other column
  const handleMappingChange = (header: string, value: string) => {
    const next = { ...mapping };
    if (value !== "__none__") {
      for (const k of Object.keys(next)) {
        if (k !== header && next[k] === value) {
          next[k] = "__none__";
        }
      }
    }
    next[header] = value;
    setMapping(next);
  };

  const MAX_ROWS = 5000;

  const runImport = async () => {
    if (!parsedFile) return;
    setImporting(true);
    try {
      const res = await fetch(`${API_BASE}/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dataType,
          // Tag each row with its original spreadsheet row index so the
          // backend can report failures against the user's source file.
          rows: validRows.map(v => ({ ...v.row, __sourceRowIndex: v.idx })),
          duplicateStrategy,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || "Import failed");
      }
      const data = await res.json();
      setImportSummary(data.summary);
      setImportResults(data.results);
      setStep("summary");
      // Invalidate related queries so the rest of the dashboard refreshes
      void queryClient.invalidateQueries();
    } catch (err) {
      setParseError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  };

  const reset = () => {
    setStep("upload");
    setParsedFile(null);
    setMapping({});
    setImportSummary(null);
    setImportResults([]);
    setParseError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const downloadFailures = () => {
    if (!parsedFile) return;
    // r.index is the original source row index (we tagged it via __sourceRowIndex).
    // Convert to a human-friendly 1-based row number including the header row.
    const failureRows = importResults
      .filter(r => r.status === "failed")
      .map(r => ({
        row_number: r.index + 2,
        reason: r.reason,
        ...(parsedFile.rows[r.index] ?? {}),
      }));
    if (failureRows.length === 0) return;
    downloadCSV(`import-failures-${dataType}-${Date.now()}.csv`, failureRows);
  };

  const downloadInvalid = () => {
    if (!parsedFile) return;
    const invalidExport = invalidRows.map(v => ({
      row_number: v.idx + 2,
      reason: v.errors.join("; "),
      ...parsedFile.rows[v.idx],
    }));
    if (invalidExport.length === 0) return;
    downloadCSV(`invalid-rows-${dataType}-${Date.now()}.csv`, invalidExport);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Import Data</h1>
        <p className="text-muted-foreground mt-1">
          Upload spreadsheets to bring your existing donor, event, and financial data into the dashboard.
        </p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 text-sm">
        {(["upload", "map", "review", "summary"] as Step[]).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${
              step === s ? "bg-primary text-primary-foreground" : ["upload", "map", "review", "summary"].indexOf(step) > i ? "bg-primary/30 text-primary" : "bg-muted text-muted-foreground"
            }`}>{i + 1}</div>
            <span className={`capitalize ${step === s ? "font-semibold" : "text-muted-foreground"}`}>{s}</span>
            {i < 3 && <div className="w-8 h-px bg-border" />}
          </div>
        ))}
      </div>

      {parseError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{parseError}</AlertDescription>
        </Alert>
      )}

      {/* STEP 1: Upload */}
      {step === "upload" && (
        <Card>
          <CardHeader>
            <CardTitle>Upload your spreadsheet</CardTitle>
            <CardDescription>Choose what kind of data you're importing, then upload a CSV or Excel file.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Data type</Label>
              <Select value={dataType} onValueChange={onDataTypeChange}>
                <SelectTrigger className="md:w-[300px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(DATA_TYPE_LABELS) as DataType[]).map(dt => (
                    <SelectItem key={dt} value={dt}>{DATA_TYPE_LABELS[dt]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Required fields: {fields.filter(f => f.required).map(f => f.label).join(", ")}
              </p>
            </div>

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
                onChange={onFileChange}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* STEP 2: Map */}
      {step === "map" && parsedFile && (
        <Card>
          <CardHeader>
            <CardTitle>Map columns</CardTitle>
            <CardDescription>
              Match the columns from <span className="font-medium">{parsedFile.fileName}</span> ({parsedFile.rows.length} rows) to the dashboard fields. Common headers were auto-detected.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-wrap items-center gap-3 rounded-md border bg-muted/40 p-3">
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={runAiMapping}
                disabled={aiMapping}
              >
                <Sparkles className="h-4 w-4 mr-2" />
                {aiMapping ? "Analyzing columns..." : "Map columns with AI"}
              </Button>
              <p className="text-xs text-muted-foreground">
                Lets AI read your headers and sample values to suggest a mapping. Always review before importing.
              </p>
            </div>

            {aiMappingError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{aiMappingError}</AlertDescription>
              </Alert>
            )}

            {aiMappingNotes && (
              <Alert>
                <Sparkles className="h-4 w-4" />
                <AlertTitle>AI suggestion</AlertTitle>
                <AlertDescription>{aiMappingNotes}</AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {parsedFile.headers.map(header => (
                <div key={header} className="space-y-1.5">
                  <Label className="text-xs">
                    Spreadsheet column: <span className="font-mono font-medium text-foreground">{header}</span>
                  </Label>
                  <Select
                    value={mapping[header] || "__none__"}
                    onValueChange={(val) => handleMappingChange(header, val)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="(skip this column)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">(skip this column)</SelectItem>
                      {fields.map(f => (
                        <SelectItem key={f.key} value={f.key}>
                          {f.label}{f.required ? " *" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            <div>
              <h3 className="font-semibold mb-2">Preview (first 20 rows)</h3>
              <div className="rounded-md border overflow-x-auto max-h-96">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {parsedFile.headers.map(h => (
                        <TableHead key={h}>
                          <div className="font-mono text-xs">{h}</div>
                          {mapping[h] && mapping[h] !== "__none__" && (
                            <div className="text-[10px] text-primary font-normal">→ {fields.find(f => f.key === mapping[h])?.label}</div>
                          )}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedFile.rows.slice(0, 20).map((row, i) => (
                      <TableRow key={i}>
                        {parsedFile.headers.map(h => (
                          <TableCell key={h} className="text-xs max-w-[200px] truncate">
                            {String(row[h] ?? "")}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            {!requiredFieldsMapped && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Map all required fields to continue: {fields.filter(f => f.required).map(f => f.label).join(", ")}
                </AlertDescription>
              </Alert>
            )}

            {duplicateMappings.length > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  More than one column is mapped to: {duplicateMappings.join(", ")}. Each field can only be used once.
                </AlertDescription>
              </Alert>
            )}

            <div className="flex justify-between">
              <Button variant="outline" onClick={reset}>
                <RotateCcw className="h-4 w-4 mr-2" /> Start over
              </Button>
              <Button onClick={() => setStep("review")} disabled={!requiredFieldsMapped || duplicateMappings.length > 0}>
                Continue to review
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* STEP 3: Review */}
      {step === "review" && parsedFile && (
        <Card>
          <CardHeader>
            <CardTitle>Review and import</CardTitle>
            <CardDescription>
              {validRows.length} valid {validRows.length === 1 ? "row" : "rows"} ready to import.
              {invalidRows.length > 0 && ` ${invalidRows.length} ${invalidRows.length === 1 ? "row has" : "rows have"} errors and will be skipped.`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 border rounded-lg">
                <div className="text-2xl font-bold">{parsedFile.rows.length}</div>
                <div className="text-xs text-muted-foreground">Total rows</div>
              </div>
              <div className="p-4 border rounded-lg bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-900">
                <div className="text-2xl font-bold text-green-700 dark:text-green-400">{validRows.length}</div>
                <div className="text-xs text-green-700 dark:text-green-400">Valid</div>
              </div>
              <div className="p-4 border rounded-lg bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900">
                <div className="text-2xl font-bold text-red-700 dark:text-red-400">{invalidRows.length}</div>
                <div className="text-xs text-red-700 dark:text-red-400">Invalid</div>
              </div>
            </div>

            {(dataType === "donors" || dataType === "events") && (
              <div className="space-y-2">
                <Label>If a duplicate is found</Label>
                <Select value={duplicateStrategy} onValueChange={(v) => setDuplicateStrategy(v as "skip" | "update" | "create")}>
                  <SelectTrigger className="md:w-[400px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="skip">Skip — keep existing record</SelectItem>
                    <SelectItem value="update">Update — overwrite with imported data</SelectItem>
                    <SelectItem value="create">Create — add as new record anyway</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {dataType === "donors" ? "Donors are matched by email." : "Events are matched by name and date."}
                </p>
              </div>
            )}

            {invalidRows.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-sm">Rows with errors</h3>
                  <Button variant="outline" size="sm" onClick={downloadInvalid}>
                    <Download className="h-3 w-3 mr-1" /> Download as CSV
                  </Button>
                </div>
                <div className="rounded-md border overflow-x-auto max-h-64">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-20">Row</TableHead>
                        <TableHead>Errors</TableHead>
                        <TableHead>Preview</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invalidRows.slice(0, 50).map(v => (
                        <TableRow key={v.idx}>
                          <TableCell className="font-mono text-xs">{v.idx + 2}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {v.errors.map((e, i) => (
                                <Badge key={i} variant="destructive" className="text-[10px]">{e}</Badge>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-md truncate">
                            {Object.entries(v.row).slice(0, 3).map(([k, val]) => `${k}: ${val}`).join(" • ")}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep("map")}>
                Back to mapping
              </Button>
              <Button onClick={runImport} disabled={importing || validRows.length === 0}>
                {importing ? "Importing..." : `Import ${validRows.length} ${validRows.length === 1 ? "row" : "rows"}`}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* STEP 4: Summary */}
      {step === "summary" && importSummary && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              Import complete
            </CardTitle>
            <CardDescription>
              {importSummary.created + importSummary.updated} {importSummary.created + importSummary.updated === 1 ? "record was" : "records were"} added or updated. The rest of the dashboard has been refreshed.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="p-4 border rounded-lg">
                <div className="text-2xl font-bold">{importSummary.total}</div>
                <div className="text-xs text-muted-foreground">Submitted</div>
              </div>
              <div className="p-4 border rounded-lg bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-900">
                <div className="text-2xl font-bold text-green-700 dark:text-green-400">{importSummary.created}</div>
                <div className="text-xs text-green-700 dark:text-green-400">Created</div>
              </div>
              <div className="p-4 border rounded-lg bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900">
                <div className="text-2xl font-bold text-blue-700 dark:text-blue-400">{importSummary.updated}</div>
                <div className="text-xs text-blue-700 dark:text-blue-400">Updated</div>
              </div>
              <div className="p-4 border rounded-lg bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900">
                <div className="text-2xl font-bold text-amber-700 dark:text-amber-400">{importSummary.skipped}</div>
                <div className="text-xs text-amber-700 dark:text-amber-400">Skipped</div>
              </div>
              <div className="p-4 border rounded-lg bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900">
                <div className="text-2xl font-bold text-red-700 dark:text-red-400">{importSummary.failed}</div>
                <div className="text-xs text-red-700 dark:text-red-400">Failed</div>
              </div>
            </div>

            {importSummary.failed > 0 && (
              <Alert>
                <XCircle className="h-4 w-4" />
                <AlertTitle>Some rows failed</AlertTitle>
                <AlertDescription className="flex items-center justify-between gap-4">
                  <span>{importSummary.failed} {importSummary.failed === 1 ? "row" : "rows"} could not be imported. Download the failure report, fix the issues, and re-upload.</span>
                  <Button variant="outline" size="sm" onClick={downloadFailures}>
                    <Download className="h-3 w-3 mr-1" /> Download failures
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            {importResults.length > 0 && (
              <div>
                <h3 className="font-semibold text-sm mb-2">Per-row results (first 50)</h3>
                <div className="rounded-md border overflow-x-auto max-h-72">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-20">Row</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Reason / ID</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {importResults.slice(0, 50).map(r => (
                        <TableRow key={r.index}>
                          <TableCell className="font-mono text-xs">{r.index + 2}</TableCell>
                          <TableCell>
                            <Badge variant={
                              r.status === "created" ? "default" :
                              r.status === "updated" ? "secondary" :
                              r.status === "failed" ? "destructive" : "outline"
                            }>
                              {r.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {r.reason || (r.id != null ? `ID: ${r.id}` : "")}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={reset}>
                <FileText className="h-4 w-4 mr-2" /> Import another file
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
