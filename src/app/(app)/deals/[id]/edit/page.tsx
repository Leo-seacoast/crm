import { notFound } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { loadPipelines } from "@/lib/records/pipelines";
import { saveDeal } from "../../actions";
import { DealForm } from "../../deal-form";

export const metadata = { title: "Edit deal · CRM" };

export default async function EditDealPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const supabase = await createClient();
  const { data: deal } = await supabase
    .from("deals")
    .select("*, contact:contacts(id, first_name, last_name, email), company:companies(id, name)")
    .eq("id", id)
    .maybeSingle();
  if (!deal) notFound();

  // Keep the deal's current stage selectable even if it was archived since.
  const pipelines = (await loadPipelines({ includeArchived: true }))
    .filter((p) => !p.archived || p.id === deal.pipeline_id)
    .map((p) => ({ ...p, stages: p.stages.filter((s) => !s.archived || s.id === deal.stage_id) }));

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold">Edit {deal.title}</h1>
      <DealForm
        action={saveDeal.bind(null, id)}
        pipelines={pipelines}
        initial={{
          title: deal.title,
          pipeline_id: deal.pipeline_id,
          stage_id: deal.stage_id,
          value: deal.value === null ? "" : String(deal.value),
          expected_close_date: deal.expected_close_date ?? "",
          contact: deal.contact
            ? {
                id: deal.contact.id,
                label:
                  [deal.contact.first_name, deal.contact.last_name].filter(Boolean).join(" ") ||
                  deal.contact.email ||
                  "Contact",
              }
            : null,
          company: deal.company ? { id: deal.company.id, label: deal.company.name } : null,
        }}
        cancelHref={`/deals/${id}`}
      />
    </main>
  );
}
