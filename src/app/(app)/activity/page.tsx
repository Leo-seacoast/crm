import { createClient } from "@/lib/supabase/server";
import { loadNames } from "@/lib/activity/names";
import { requireUser } from "@/lib/auth/session";
import {
  actionLabel,
  actorLabel,
  describeChanges,
  recordName,
  referencedIds,
  tableLabel,
} from "@/lib/activity/format";

export const metadata = { title: "Activity · CRM" };

function exportRows(context: unknown): string {
  const rows = context && typeof context === "object" ? (context as { rows?: unknown }).rows : undefined;
  return typeof rows === "number" ? rows.toLocaleString("en-US") : "?";
}

const PAGE_SIZE = 100;

export default async function ActivityPage() {
  await requireUser();
  const supabase = await createClient();

  const { data: entries, error } = await supabase
    .from("activity_log")
    .select(
      "id, occurred_at, actor_type, action, table_name, record_id, changes, context, actor:profiles(full_name, email)",
    )
    .order("occurred_at", { ascending: false })
    .limit(PAGE_SIZE);

  // Current names of team members mentioned, for entries that don't include a name
  // (e.g. a role change only records the role).
  const profileIds = [
    ...new Set(
      (entries ?? [])
        .filter((e) => e.table_name === "profiles" && e.record_id)
        .map((e) => e.record_id as string),
    ),
  ];
  const { data: people } = profileIds.length
    ? await supabase.from("profiles").select("id, full_name, email").in("id", profileIds)
    : { data: [] };
  const currentName = new Map((people ?? []).map((p) => [p.id, p.full_name ?? p.email]));
  const names = await loadNames(referencedIds(entries ?? []));

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 p-8">
      <div>
        <h1 className="text-2xl font-semibold">Activity</h1>
        <p className="text-sm text-neutral-500">
          Every change, newest first (last {PAGE_SIZE}). This history can&apos;t be edited or deleted.
        </p>
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-600">
          Could not load activity. Please refresh.
        </p>
      )}

      {entries && entries.length === 0 && <p className="text-neutral-500">No activity yet.</p>}

      <ol className="flex flex-col divide-y divide-neutral-200 dark:divide-neutral-800">
        {entries?.map((e) => {
          const who = actorLabel(e.actor_type, e.actor);
          const name =
            recordName(e.changes) ?? (e.record_id ? currentName.get(e.record_id) : undefined) ?? null;
          const fields = describeChanges(e.action, e.changes, names);
          return (
            <li key={e.id} className="flex flex-col gap-1 py-3">
              <div className="text-sm">
                <strong>{who}</strong> {actionLabel(e.action)} {tableLabel(e.table_name).toLowerCase()}
                {e.action === "export" && ` records to CSV (${exportRows(e.context)} rows)`}
                {name && (
                  <>
                    {" "}
                    <strong>{name}</strong>
                  </>
                )}
              </div>
              {fields.length > 0 && (
                <ul className="text-sm text-neutral-600 dark:text-neutral-400">
                  {fields.map((f) => (
                    <li key={f.field}>
                      {f.field}: {f.from} → {f.to}
                    </li>
                  ))}
                </ul>
              )}
              <time className="text-xs text-neutral-500" dateTime={e.occurred_at}>
                {new Date(e.occurred_at).toLocaleString("en-US", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </time>
            </li>
          );
        })}
      </ol>
    </main>
  );
}
