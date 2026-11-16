import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/session";
import { formatMoney } from "@/lib/money";
import { loadPipelines } from "@/lib/records/pipelines";
import { STAGE_KIND_LABELS } from "@/lib/records/schemas";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArchiveButton } from "@/components/archive-button";
import { RecordHistory } from "@/components/record-history";
import { archiveDeal } from "../actions";
import { StagePicker } from "./stage-picker";

export default async function DealPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const user = await requireUser();
  const supabase = await createClient();
  const { data: deal } = await supabase
    .from("deals")
    .select(
      "*, contact:contacts(id, first_name, last_name, email), company:companies(id, name), stage:pipeline_stages(id, name, kind), pipeline:pipelines(id, name)",
    )
    .eq("id", id)
    .maybeSingle();
  if (!deal) notFound();

  const archived = !!deal.archived_at;
  const canEdit = !archived || user.role === "admin";
  const stages = (await loadPipelines()).find((p) => p.id === deal.pipeline_id)?.stages ?? [];

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-8 p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href={`/deals?pipeline=${deal.pipeline_id}`} className="text-sm text-muted-foreground hover:underline">
            ← {deal.pipeline?.name ?? "Deals"}
          </Link>
          <h1 className="mt-1 text-2xl font-semibold">
            {deal.title}
            {archived && (
              <Badge variant="outline" className="ml-3 align-middle">
                Archived
              </Badge>
            )}
          </h1>
          <div className="mt-2 flex items-center gap-2 text-sm">
            <Badge variant={deal.stage?.kind === "won" ? "default" : deal.stage?.kind === "lost" ? "destructive" : "secondary"}>
              {deal.stage?.name}
            </Badge>
            {deal.stage && deal.stage.kind !== "open" && (
              <span className="text-muted-foreground">
                {STAGE_KIND_LABELS[deal.stage.kind]}
                {deal.closed_at &&
                  ` on ${new Date(deal.closed_at).toLocaleDateString("en-US", { dateStyle: "medium" })}`}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-start gap-3">
          {canEdit && (
            <Button variant="outline" asChild>
              <Link href={`/deals/${id}/edit`}>Edit</Link>
            </Button>
          )}
          {canEdit ? (
            <ArchiveButton archived={archived} action={archiveDeal.bind(null, id, !archived)} />
          ) : (
            <p className="max-w-48 text-xs text-muted-foreground">Only an admin can restore this deal.</p>
          )}
        </div>
      </div>

      {!archived && stages.length > 0 && <StagePicker dealId={id} stageId={deal.stage_id} stages={stages} />}

      <dl className="grid gap-4 text-sm sm:grid-cols-2">
        <Detail label="Value">{formatMoney(deal.value, deal.currency)}</Detail>
        <Detail label="Expected close">
          {deal.expected_close_date &&
            new Date(`${deal.expected_close_date}T12:00:00`).toLocaleDateString("en-US", { dateStyle: "medium" })}
        </Detail>
        <Detail label="Contact">
          {deal.contact && (
            <Link href={`/contacts/${deal.contact.id}`} className="hover:underline">
              {[deal.contact.first_name, deal.contact.last_name].filter(Boolean).join(" ") || deal.contact.email}
            </Link>
          )}
        </Detail>
        <Detail label="Company">
          {deal.company && (
            <Link href={`/companies/${deal.company.id}`} className="hover:underline">
              {deal.company.name}
            </Link>
          )}
        </Detail>
      </dl>

      <RecordHistory table="deals" recordId={id} />
    </main>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-1">{children || <span className="text-muted-foreground">—</span>}</dd>
    </div>
  );
}
