"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import Papa from "papaparse";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { selectClass } from "@/components/form-field";
import { cn } from "@/lib/utils";
import { CSV_BOM, csvRow } from "@/lib/csv";
import { CONTACT_TYPE_LABELS, CONTACT_TYPES, type ContactType } from "@/lib/records/schemas";
import {
  cleanRow,
  guessMapping,
  lookupBatches,
  planRows,
  summarise,
  TARGETS,
  type Existing,
  type ExistingMode,
  type Mapping,
  type PlannedRow,
  type Target,
} from "@/lib/import/ghl-contacts";
import { MAX_ROWS_PER_BATCH, type ImportContactRow } from "@/lib/import/import-row-schema";
import {
  findExistingContacts,
  finishImport,
  importCompanies,
  importContactBatch,
  startContactImport,
  type BatchResult,
} from "./actions";

const MAX_FILE_MB = 50;
const MAX_ROWS = 100_000;
const MAX_BATCH_CHARS = 700_000; // keeps each upload well under the server's size limit
const LOOKUP_CHUNK = 900;

type Parsed = { fileName: string; headers: string[]; rows: Record<string, string>[]; parseErrors: number };
type Stage = "choose" | "map" | "checking" | "preview" | "importing" | "done";
type Outcome = { created: number; updated: number; skipped: number; companies: number; errors: { row: number; message: string }[]; stopped?: string };

export function ImportWizard() {
  const [stage, setStage] = useState<Stage>("choose");
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [mapping, setMapping] = useState<Mapping>({});
  const [defaultType, setDefaultType] = useState<ContactType | "">("");
  const [mode, setMode] = useState<ExistingMode>("fill_blanks");
  const [plan, setPlan] = useState<PlannedRow[]>([]);
  const [progress, setProgress] = useState({ done: 0, total: 0, label: "" });
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [error, setError] = useState<string>();

  // Warn before closing the tab in the middle of an import.
  useEffect(() => {
    if (stage !== "importing") return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [stage]);

  // ---- 1. Choose and read the file (in the browser) -------------------------
  function onFile(file: File | undefined) {
    setError(undefined);
    if (!file) return;
    if (!/\.csv$/i.test(file.name)) return setError("Please choose a .csv file exported from GHL.");
    if (file.size > MAX_FILE_MB * 1024 * 1024) return setError(`That file is over ${MAX_FILE_MB} MB.`);

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (h) => h.replace(/^﻿/, "").trim(),
      complete: (result) => {
        const headers = (result.meta.fields ?? []).filter((h, i, all) => all.indexOf(h) === i);
        if (headers.length === 0 || result.data.length === 0) return setError("That file has no rows to import.");
        if (result.data.length > MAX_ROWS) return setError(`That file has over ${MAX_ROWS.toLocaleString()} rows.`);
        setParsed({ fileName: file.name, headers, rows: result.data, parseErrors: result.errors.length });
        setMapping(guessMapping(headers));
        setStage("map");
      },
      error: () => setError("That file couldn't be read. Is it a CSV export?"),
    });
  }

  // ---- 2 → 3. Clean every row and check for existing contacts ---------------
  async function buildPreview() {
    if (!parsed) return;
    setStage("checking");
    setError(undefined);
    const cleaned = parsed.rows.map((raw, i) => cleanRow(raw, mapping, i + 2));

    const emails = [...new Set(cleaned.map((r) => r.contact?.email).filter((e): e is string => !!e))];
    const phones = [...new Set(cleaned.map((r) => r.contact?.phone).filter((p): p is string => !!p))];
    const ghlIds = [...new Set(cleaned.map((r) => r.contact?.ghl_id).filter((g): g is string => !!g))];
    // The database returns at most 1,000 records per request, so each lookup asks
    // about at most 900 values in total — the answer can never be cut short.
    const lookups = lookupBatches({ emails, phones, ghlIds }, LOOKUP_CHUNK);
    const found = new Map<string, Existing>();
    for (const [i, batch] of lookups.entries()) {
      setProgress({ done: i, total: lookups.length, label: "Checking for contacts already in the CRM" });
      const r = await findExistingContacts(batch.emails, batch.phones, batch.ghlIds);
      if (!r.ok) {
        setStage("map");
        return setError(r.message);
      }
      for (const e of r.data) found.set(e.id, e);
    }
    setPlan(planRows(cleaned, [...found.values()], mode));
    setStage("preview");
  }

  const summary = useMemo(() => summarise(plan), [plan]);

  // ---- 4. Import --------------------------------------------------------------
  async function runImport() {
    if (!parsed) return;
    setStage("importing");
    setError(undefined);
    const toSend = plan.filter((p) => p.action !== "skip" && p.contact);
    const result: Outcome = { created: 0, updated: 0, skipped: 0, companies: 0, errors: [] };

    const started = await startContactImport(parsed.fileName, parsed.rows.length, {
      mapping,
      defaultType: defaultType || null,
      existingContacts: mode,
    });
    if (!started.ok) {
      setStage("preview");
      return setError(started.message);
    }
    const importId = started.data;

    // Companies first, so contacts can be linked to them.
    const names = [...new Set(toSend.map((p) => p.contact!.company_name).filter((n): n is string => !!n))];
    const companyIds: Record<string, string> = {};
    for (let i = 0; i < names.length; i += 500) {
      setProgress({ done: i, total: names.length, label: "Creating companies" });
      const r = await importCompanies(importId, names.slice(i, i + 500));
      if (!r.ok) return stop(result, r.message);
      Object.assign(companyIds, r.data);
    }

    // Then contacts, in batches.
    const rows: ImportContactRow[] = toSend.map((p) => {
      const { company_name, ...c } = p.contact!;
      return {
        ...c,
        row: p.row,
        action: p.action as "create" | "update",
        ...(p.action === "update" ? { target_id: p.targetId } : {}),
        company_id: company_name ? (companyIds[company_name.toLowerCase()] ?? null) : null,
        types: defaultType ? [defaultType] : [],
        source: c.source ?? "GHL import",
      };
    });

    const batches: ImportContactRow[][] = [];
    let current: ImportContactRow[] = [];
    let size = 0;
    for (const row of rows) {
      const s = JSON.stringify(row).length;
      if (current.length && (current.length >= MAX_ROWS_PER_BATCH || size + s > MAX_BATCH_CHARS)) {
        batches.push(current);
        current = [];
        size = 0;
      }
      current.push(row);
      size += s;
    }
    if (current.length) batches.push(current);

    let sent = 0;
    for (const batch of batches) {
      setProgress({ done: sent, total: rows.length, label: "Importing contacts" });
      const r = await importContactBatch(importId, batch);
      if (!r.ok) return stop(result, r.message);
      add(result, r.data);
      sent += batch.length;
    }

    const skippedInPreview = plan.length - toSend.length;
    await finishImport(importId, skippedInPreview);
    result.skipped += skippedInPreview;
    result.companies = names.length;
    setOutcome(result);
    setStage("done");
  }

  function add(total: Outcome, r: BatchResult) {
    total.created += r.created;
    total.updated += r.updated;
    total.skipped += r.skipped;
    total.errors.push(...r.errors);
  }

  function stop(result: Outcome, message: string) {
    setOutcome({ ...result, stopped: message });
    setStage("done");
  }

  function downloadSkipped() {
    const skipped = plan.filter((p) => p.action === "skip");
    const lines = [csvRow(["Row", "Reason", ...(parsed?.headers ?? [])])];
    for (const p of skipped) {
      const raw = parsed!.rows[p.row - 2] ?? {};
      lines.push(csvRow([p.row, p.reason ?? "", ...parsed!.headers.map((h) => raw[h] ?? "")]));
    }
    const blob = new Blob([CSV_BOM + lines.join("")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "skipped-rows.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function reset() {
    setStage("choose");
    setParsed(null);
    setPlan([]);
    setOutcome(null);
    setError(undefined);
  }

  // ---- Screens ----------------------------------------------------------------
  return (
    <div className="flex flex-col gap-6">
      <Steps stage={stage} />
      {error && (
        <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      )}

      {stage === "choose" && (
        <section className="flex flex-col gap-3 rounded-lg border p-6">
          <h2 className="font-semibold">1. Choose your GHL contacts export</h2>
          <p className="text-sm text-muted-foreground">
            In GHL: Contacts → select all → Export, then choose the downloaded .csv file here. The file is read on
            your computer; nothing is saved until you confirm the preview.
          </p>
          <input
            type="file"
            accept=".csv,text/csv"
            aria-label="GHL contacts CSV file"
            onChange={(e) => onFile(e.target.files?.[0])}
            className="text-sm file:mr-3 file:rounded-md file:border file:border-input file:bg-background file:px-3 file:py-1.5"
          />
        </section>
      )}

      {stage === "map" && parsed && (
        <section className="flex flex-col gap-4">
          <div>
            <h2 className="font-semibold">2. Check how the columns match</h2>
            <p className="text-sm text-muted-foreground">
              {parsed.fileName}: {parsed.rows.length.toLocaleString()} rows, {parsed.headers.length} columns.
              {parsed.parseErrors > 0 && ` ${parsed.parseErrors} rows looked damaged and may be skipped.`} We&apos;ve
              matched GHL&apos;s columns automatically — change any that look wrong. Columns we don&apos;t have a
              place for are kept as <strong>extra fields</strong> on each contact.
            </p>
          </div>

          <div className="max-h-[28rem] overflow-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted text-left">
                <tr>
                  <th className="p-2">GHL column</th>
                  <th className="p-2">Example</th>
                  <th className="p-2">Goes into</th>
                </tr>
              </thead>
              <tbody>
                {parsed.headers.map((h) => (
                  <tr key={h} className="border-t">
                    <td className="p-2 font-medium">{h || <em>(no name)</em>}</td>
                    <td className="max-w-56 truncate p-2 text-muted-foreground">
                      {parsed.rows.find((r) => r[h]?.trim())?.[h] ?? ""}
                    </td>
                    <td className="p-2">
                      <select
                        aria-label={`Where ${h} goes`}
                        value={mapping[h]}
                        onChange={(e) => setMapping({ ...mapping, [h]: e.target.value as Target })}
                        className={cn(selectClass, "w-64")}
                      >
                        {Object.entries(TARGETS).map(([k, label]) => (
                          <option key={k} value={k}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm font-medium">
              Contact type for everyone in this file (optional)
              <select value={defaultType} onChange={(e) => setDefaultType(e.target.value as ContactType | "")} className={selectClass}>
                <option value="">— No type —</option>
                {CONTACT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {CONTACT_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              If a contact is already in the CRM (same email or phone)
              <select value={mode} onChange={(e) => setMode(e.target.value as ExistingMode)} className={selectClass}>
                <option value="fill_blanks">Fill in blanks only (never overwrite)</option>
                <option value="skip">Skip it</option>
              </select>
            </label>
          </div>
          <p className="text-xs text-muted-foreground">
            Consent: anyone marked <strong>DND</strong> in GHL is imported as <strong>opted out</strong>. Everyone else
            is imported as <strong>not asked</strong> — a GHL export doesn&apos;t show when or how someone agreed.
          </p>

          <div className="flex gap-3">
            <Button onClick={buildPreview}>Preview import</Button>
            <Button variant="outline" onClick={reset}>
              Choose a different file
            </Button>
          </div>
        </section>
      )}

      {(stage === "checking" || stage === "importing") && (
        <section className="flex flex-col gap-2 rounded-lg border p-6" aria-live="polite">
          <p className="font-medium">{progress.label || "Working"}…</p>
          <div className="h-2 w-full overflow-hidden rounded bg-muted">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${progress.total ? Math.round((progress.done / progress.total) * 100) : 5}%` }}
            />
          </div>
          {stage === "importing" && (
            <p className="text-xs text-muted-foreground">
              {progress.done.toLocaleString()} of {progress.total.toLocaleString()} — please keep this page open.
            </p>
          )}
        </section>
      )}

      {stage === "preview" && (
        <section className="flex flex-col gap-4">
          <h2 className="font-semibold">3. Preview — nothing has been saved yet</h2>
          <div className="grid gap-3 sm:grid-cols-5">
            <Stat label="New contacts" value={summary.create} />
            <Stat label={mode === "fill_blanks" ? "Already in CRM — fill in blanks" : "Already in CRM"} value={summary.update} />
            <Stat label="Skipped" value={summary.skip} tone={summary.skip ? "warn" : undefined} />
            <Stat label="Imported with a warning" value={summary.warnings} />
            <Stat label="Companies linked" value={summary.companies} />
          </div>

          <RowList
            title="Skipped rows"
            rows={plan.filter((p) => p.action === "skip")}
            describe={(p) => p.reason ?? ""}
            action={
              summary.skip > 0 && (
                <Button variant="outline" size="sm" onClick={downloadSkipped}>
                  Download skipped rows (CSV)
                </Button>
              )
            }
          />
          <RowList
            title="Warnings (these rows are still imported)"
            rows={plan.filter((p) => p.action !== "skip" && p.warnings.length)}
            describe={(p) => p.warnings.join("; ")}
          />
          <RowList
            title="Existing contacts that will be filled in"
            rows={plan.filter((p) => p.action === "update")}
            describe={(p) => `Matches ${p.matchedName}`}
          />

          <div className="flex gap-3">
            <Button onClick={runImport} disabled={summary.create + summary.update === 0}>
              Import {(summary.create + summary.update).toLocaleString()} contacts
            </Button>
            <Button variant="outline" onClick={() => setStage("map")}>
              Back to column matching
            </Button>
          </div>
        </section>
      )}

      {stage === "done" && outcome && (
        <section className="flex flex-col gap-4">
          <h2 className="font-semibold">{outcome.stopped ? "Import stopped" : "4. Import finished"}</h2>
          {outcome.stopped && (
            <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              {outcome.stopped} Everything saved so far is listed under &quot;Past imports&quot; below — you can undo
              it there and try again.
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-4">
            <Stat label="Created" value={outcome.created} />
            <Stat label="Filled in" value={outcome.updated} />
            <Stat label="Skipped" value={outcome.skipped} />
            <Stat label="Errors" value={outcome.errors.length} tone={outcome.errors.length ? "warn" : undefined} />
          </div>
          {outcome.errors.length > 0 && (
            <ul className="max-h-60 overflow-auto rounded-lg border p-3 text-sm">
              {outcome.errors.slice(0, 200).map((e, i) => (
                <li key={i}>
                  Row {e.row}: {e.message}
                </li>
              ))}
            </ul>
          )}
          <div className="flex gap-3">
            <Button asChild>
              <Link href="/contacts">View contacts</Link>
            </Button>
            <Button variant="outline" onClick={() => window.location.reload()}>
              Import another file
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}

function Steps({ stage }: { stage: Stage }) {
  const order: Stage[] = ["choose", "map", "preview", "done"];
  const current = stage === "checking" ? "map" : stage === "importing" ? "preview" : stage;
  const labels = ["Choose file", "Match columns", "Preview", "Done"];
  return (
    <ol className="flex flex-wrap gap-2 text-xs">
      {order.map((s, i) => (
        <li key={s}>
          <Badge variant={s === current ? "default" : "outline"}>
            {i + 1}. {labels[i]}
          </Badge>
        </li>
      ))}
    </ol>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "warn" }) {
  return (
    <div className={cn("rounded-lg border p-3", tone === "warn" && "border-amber-400")}>
      <div className="text-2xl font-semibold">{value.toLocaleString()}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function RowList({
  title,
  rows,
  describe,
  action,
}: {
  title: string;
  rows: PlannedRow[];
  describe: (p: PlannedRow) => string;
  action?: React.ReactNode;
}) {
  if (rows.length === 0) return null;
  const name = (p: PlannedRow) =>
    [p.contact?.first_name, p.contact?.last_name].filter(Boolean).join(" ") || p.contact?.email || p.contact?.phone || "";
  return (
    <details className="rounded-lg border p-3 text-sm">
      <summary className="cursor-pointer font-medium">
        {title} ({rows.length.toLocaleString()})
      </summary>
      <div className="mt-2 flex flex-col gap-2">
        {action}
        <ul className="max-h-60 overflow-auto">
          {rows.slice(0, 200).map((p) => (
            <li key={p.row} className="border-t py-1">
              <span className="text-muted-foreground">Row {p.row}</span> {name(p)} — {describe(p)}
            </li>
          ))}
        </ul>
        {rows.length > 200 && <p className="text-xs text-muted-foreground">Showing the first 200.</p>}
      </div>
    </details>
  );
}
