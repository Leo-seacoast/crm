import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { ImportWizard } from "./import-wizard";
import { UndoImportButton } from "./undo-button";

export const metadata = { title: "Import · CRM" };

export default async function ImportPage() {
  const supabase = await createClient();
  const { data: imports } = await supabase
    .from("imports")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);

  const ids = [...new Set((imports ?? []).map((i) => i.created_by).filter((x): x is string => !!x))];
  const { data: people } = ids.length
    ? await supabase.from("profiles").select("id, full_name, email").in("id", ids)
    : { data: [] };
  const who = new Map((people ?? []).map((p) => [p.id, p.full_name ?? p.email]));

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-8 p-8">
      <div>
        <h1 className="text-2xl font-semibold">Import from GHL</h1>
        <p className="text-sm text-muted-foreground">
          Bring contacts (and their companies) in from a GoHighLevel CSV export. You&apos;ll see a preview with
          duplicates and problems before anything is saved, and every import can be undone.
        </p>
      </div>

      <ImportWizard />

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Past imports</h2>
        {(imports ?? []).length === 0 && <p className="text-sm text-muted-foreground">No imports yet.</p>}
        <ul className="flex flex-col divide-y divide-border rounded-lg border">
          {imports?.map((imp) => (
            <li key={imp.id} className="flex flex-wrap items-center justify-between gap-3 p-3 text-sm">
              <div>
                <div className="font-medium">
                  {imp.file_name}{" "}
                  <Badge variant={imp.status === "undone" ? "outline" : imp.status === "completed" ? "secondary" : "default"}>
                    {imp.status === "in_progress" ? "Not finished" : imp.status === "undone" ? "Undone" : "Completed"}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground">
                  {new Date(imp.created_at).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })} by{" "}
                  {(imp.created_by && who.get(imp.created_by)) ?? "an admin"} · {imp.total_rows.toLocaleString()} rows ·{" "}
                  {imp.created_count.toLocaleString()} created · {imp.updated_count.toLocaleString()} filled in ·{" "}
                  {imp.skipped_count.toLocaleString()} skipped · {imp.error_count.toLocaleString()} errors ·{" "}
                  {imp.companies_created.toLocaleString()} new companies
                </div>
              </div>
              {imp.status !== "undone" && <UndoImportButton importId={imp.id} created={imp.created_count} />}
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground">
          Undo archives the contacts and companies an import created (nothing is deleted, and archived records can be
          restored). Existing contacts it filled in keep the added details; their history shows exactly what changed.
        </p>
      </section>
    </main>
  );
}
