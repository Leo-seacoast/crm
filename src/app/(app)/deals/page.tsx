import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/session";
import { loadPipelines } from "@/lib/records/pipelines";
import { formatPhone } from "@/lib/phone";
import { Button } from "@/components/ui/button";
import { DealBoard, type BoardDeal } from "./deal-board";
import { ExportButton } from "@/components/export-button";

export const metadata = { title: "Deals · CRM" };

export default async function DealsPage({ searchParams }: { searchParams: Promise<{ pipeline?: string }> }) {
  const { pipeline: requested } = await searchParams;
  const user = await requireUser();
  const pipelines = await loadPipelines();
  const pipeline = pipelines.find((p) => p.id === requested) ?? pipelines[0];

  if (!pipeline) {
    return (
      <main className="mx-auto max-w-3xl p-8">
        <h1 className="text-2xl font-semibold">Deals</h1>
        <p className="mt-4 text-muted-foreground">
          No pipelines yet.{" "}
          {user.role === "admin" ? <Link href="/settings/pipelines" className="underline">Create one in Settings.</Link> : "Ask an admin to create one."}
        </p>
      </main>
    );
  }

  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("deals")
    .select(
      "id, title, stage_id, value, currency, expected_close_date, contact:contacts(first_name, last_name, email, phone), company:companies(name)",
    )
    .eq("pipeline_id", pipeline.id)
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .limit(2000);

  const deals: BoardDeal[] = (rows ?? []).map((d) => {
    const person = d.contact
      ? [d.contact.first_name, d.contact.last_name].filter(Boolean).join(" ") || d.contact.email || formatPhone(d.contact.phone)
      : null;
    return {
      id: d.id,
      title: d.title,
      stage_id: d.stage_id,
      value: d.value === null ? null : Number(d.value),
      currency: d.currency,
      expected_close_date: d.expected_close_date,
      who: [person, d.company?.name].filter(Boolean).join(" · ") || null,
    };
  });

  return (
    <main className="flex flex-col gap-6 p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="mr-4 text-2xl font-semibold">Deals</h1>
          <nav aria-label="Pipelines" className="flex flex-wrap gap-1">
            {pipelines.map((p) => (
              <Button key={p.id} variant={p.id === pipeline.id ? "secondary" : "ghost"} size="sm" asChild>
                <Link href={`/deals?pipeline=${p.id}`} aria-current={p.id === pipeline.id ? "page" : undefined}>
                  {p.name}
                </Link>
              </Button>
            ))}
          </nav>
        </div>
        <div className="flex gap-2">
          {user.role === "admin" && (
            <>
              <ExportButton href={`/export/deals?pipeline=${pipeline.id}`} label="Export this pipeline" />
              <ExportButton href="/export/deals" label="Export all deals" />
            </>
          )}
          <Button asChild>
            <Link href={`/deals/new?pipeline=${pipeline.id}`}>Add deal</Link>
          </Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">Drag a card to another column to change its stage.</p>
      {/* key: reset the board when switching pipelines */}
      <DealBoard key={pipeline.id} stages={pipeline.stages} initialDeals={deals} />
    </main>
  );
}
