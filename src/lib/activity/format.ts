/** Turns raw activity-log entries into plain-English text for the screen. */

const TABLE_LABELS: Record<string, string> = {
  profiles: "Team member",
  contacts: "Contact",
  companies: "Company",
  deals: "Deal",
  pipelines: "Pipeline",
  pipeline_stages: "Stage",
};

const ACTION_LABELS: Record<string, string> = {
  create: "created",
  update: "updated",
  archive: "archived",
  restore: "restored",
  delete: "permanently deleted",
};

/** Friendlier names for fields that would read oddly if just "humanized". */
const FIELD_LABELS: Record<string, string> = {
  stage_id: "Stage",
  pipeline_id: "Pipeline",
  contact_id: "Contact",
  company_id: "Company",
  closed_at: "Closed",
  expected_close_date: "Expected close date",
};

/** Fields that point at another record; their ids are swapped for names when shown. */
export const REFERENCE_FIELDS = ["stage_id", "pipeline_id", "contact_id", "company_id"] as const;

/** Fields not worth showing to a person reading the history. */
const HIDDEN_FIELDS = new Set(["id", "created_at", "updated_at", "created_by", "owner_id", "position"]);

/** Who did it, in words. A person whose account was removed is never shown as "System". */
export function actorLabel(
  actorType: string,
  actor: { full_name: string | null; email: string } | null,
): string {
  if (actor) return actor.full_name ?? actor.email;
  if (actorType === "user") return "A removed team member";
  if (actorType === "automation") return "Automation";
  return "System";
}

export function tableLabel(table: string): string {
  return TABLE_LABELS[table] ?? humanize(table);
}

export function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? humanize(action);
}

export function fieldLabel(field: string): string {
  return FIELD_LABELS[field] ?? humanize(field);
}

export function humanize(key: string): string {
  const s = key.replace(/_/g, " ").trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "(empty)";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
    }
  }
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return text.length > 80 ? `${text.slice(0, 77)}…` : text;
}

export type FieldChange = { field: string; from: string; to: string };

/** Looks up a readable name for an id (e.g. a stage id -> "Proposal sent"). */
export type NameLookup = (id: string) => string | undefined;

/** For updates: list each changed field as "from -> to". */
export function describeChanges(action: string, changes: unknown, names?: NameLookup): FieldChange[] {
  if (action !== "update" && action !== "archive" && action !== "restore") return [];
  if (!changes || typeof changes !== "object" || Array.isArray(changes)) return [];

  const show = (field: string, value: unknown) => {
    if (names && typeof value === "string" && (REFERENCE_FIELDS as readonly string[]).includes(field)) {
      return names(value) ?? "(removed record)";
    }
    return formatValue(value);
  };

  return Object.entries(changes as Record<string, unknown>)
    .filter(([field]) => !HIDDEN_FIELDS.has(field) && field !== "archived_at")
    .map(([field, diff]) => {
      const d = (diff ?? {}) as { old?: unknown; new?: unknown };
      return { field: fieldLabel(field), from: show(field, d.old), to: show(field, d.new) };
    });
}

/** All ids mentioned in reference fields of these log entries (to look their names up in one go). */
export function referencedIds(entries: { changes: unknown }[]): string[] {
  const ids = new Set<string>();
  for (const e of entries) {
    if (!e.changes || typeof e.changes !== "object") continue;
    for (const field of REFERENCE_FIELDS) {
      const diff = (e.changes as Record<string, unknown>)[field];
      if (diff && typeof diff === "object") {
        for (const v of [(diff as { old?: unknown }).old, (diff as { new?: unknown }).new]) {
          if (typeof v === "string") ids.add(v);
        }
      }
    }
  }
  return [...ids];
}

/** A short name for the record, taken from the snapshot/changes if available. */
export function recordName(changes: unknown): string | null {
  if (!changes || typeof changes !== "object") return null;
  const c = changes as Record<string, unknown>;
  const pick = (k: string) => {
    const v = c[k];
    if (typeof v === "string") return v;
    if (v && typeof v === "object" && "new" in v && typeof (v as { new: unknown }).new === "string")
      return (v as { new: string }).new;
    return null;
  };
  const person = [pick("first_name"), pick("last_name")].filter(Boolean).join(" ");
  return pick("full_name") ?? (person || null) ?? pick("title") ?? pick("name") ?? pick("email");
}
