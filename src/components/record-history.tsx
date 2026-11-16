import { createClient } from "@/lib/supabase/server";
import { actionLabel, actorLabel, describeChanges } from "@/lib/activity/format";

/** The change history for one record, from the activity log. */
export async function RecordHistory({ table, recordId }: { table: string; recordId: string }) {
  const supabase = await createClient();
  const { data: entries } = await supabase
    .from("activity_log")
    .select("id, occurred_at, actor_type, action, changes, actor:profiles(full_name, email)")
    .eq("table_name", table)
    .eq("record_id", recordId)
    .order("occurred_at", { ascending: false })
    .limit(50);

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">History</h2>
      {(!entries || entries.length === 0) && <p className="text-sm text-muted-foreground">No history yet.</p>}
      <ol className="flex flex-col divide-y divide-border">
        {entries?.map((e) => {
          const fields = describeChanges(e.action, e.changes);
          return (
            <li key={e.id} className="flex flex-col gap-1 py-2 text-sm">
              <div>
                <strong>{actorLabel(e.actor_type, e.actor)}</strong> {actionLabel(e.action)} this record
              </div>
              {fields.length > 0 && (
                <ul className="text-muted-foreground">
                  {fields.map((f) => (
                    <li key={f.field}>
                      {f.field}: {f.from} → {f.to}
                    </li>
                  ))}
                </ul>
              )}
              <time className="text-xs text-muted-foreground" dateTime={e.occurred_at}>
                {new Date(e.occurred_at).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
              </time>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
