/** Turns raw activity-log entries into plain-English text for the screen. */

const TABLE_LABELS: Record<string, string> = {
  profiles: "Team member",
  contacts: "Contact",
  companies: "Company",
};

const ACTION_LABELS: Record<string, string> = {
  create: "created",
  update: "updated",
  archive: "archived",
  restore: "restored",
  delete: "permanently deleted",
};

/** Fields not worth showing to a person reading the history. */
const HIDDEN_FIELDS = new Set(["id", "created_at", "updated_at", "created_by", "owner_id"]);

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

/** For updates: list each changed field as "from -> to". */
export function describeChanges(action: string, changes: unknown): FieldChange[] {
  if (action !== "update" && action !== "archive" && action !== "restore") return [];
  if (!changes || typeof changes !== "object" || Array.isArray(changes)) return [];

  return Object.entries(changes as Record<string, unknown>)
    .filter(([field]) => !HIDDEN_FIELDS.has(field) && field !== "archived_at")
    .map(([field, diff]) => {
      const d = (diff ?? {}) as { old?: unknown; new?: unknown };
      return { field: humanize(field), from: formatValue(d.old), to: formatValue(d.new) };
    });
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
  return pick("full_name") ?? (person || null) ?? pick("name") ?? pick("email");
}
