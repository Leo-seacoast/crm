import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { loadPipelines } from "@/lib/records/pipelines";
import { saveDeal } from "../actions";
import { DealForm } from "../deal-form";

export const metadata = { title: "Add deal · CRM" };

const uuidOrNull = (v: string | undefined) => (z.uuid().safeParse(v).success ? v! : null);

export default async function NewDealPage({
  searchParams,
}: {
  searchParams: Promise<{ pipeline?: string; contact?: string; company?: string }>;
}) {
  const params = await searchParams;
  const pipelines = await loadPipelines();
  const supabase = await createClient();

  // Pre-fill from links such as "Add deal" on a contact or company page.
  const contactId = uuidOrNull(params.contact);
  const companyId = uuidOrNull(params.company);
  const [{ data: contact }, { data: company }] = await Promise.all([
    contactId
      ? supabase.from("contacts").select("id, first_name, last_name, email, company_id").eq("id", contactId).maybeSingle()
      : Promise.resolve({ data: null }),
    companyId
      ? supabase.from("companies").select("id, name").eq("id", companyId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  // A contact's own company is filled in automatically.
  let linkedCompany = company;
  if (!linkedCompany && contact?.company_id) {
    const { data } = await supabase.from("companies").select("id, name").eq("id", contact.company_id).maybeSingle();
    linkedCompany = data;
  }

  const cancelHref = contact ? `/contacts/${contact.id}` : company ? `/companies/${company.id}` : "/deals";

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold">Add deal</h1>
      {pipelines.length === 0 ? (
        <p className="text-muted-foreground">There are no pipelines yet. An admin needs to create one in Settings.</p>
      ) : (
        <DealForm
          action={saveDeal.bind(null, null)}
          pipelines={pipelines}
          initial={{
            pipeline_id: uuidOrNull(params.pipeline) ?? undefined,
            contact: contact
              ? {
                  id: contact.id,
                  label: [contact.first_name, contact.last_name].filter(Boolean).join(" ") || contact.email || "Contact",
                }
              : null,
            company: linkedCompany ? { id: linkedCompany.id, label: linkedCompany.name } : null,
          }}
          cancelHref={cancelHref}
        />
      )}
    </main>
  );
}
