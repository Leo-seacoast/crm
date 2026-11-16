import { notFound } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { formatPhone } from "@/lib/phone";
import { saveContact } from "../../actions";
import { ContactForm } from "../../contact-form";
import { loadContactFormOptions } from "../../load-form-options";

export const metadata = { title: "Edit contact · CRM" };

export default async function EditContactPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const supabase = await createClient();
  const { data: contact } = await supabase.from("contacts").select("*").eq("id", id).maybeSingle();
  if (!contact) notFound();

  const { companies, timeZones } = await loadContactFormOptions(contact.company_id);
  const name = [contact.first_name, contact.last_name].filter(Boolean).join(" ") || "contact";

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold">Edit {name}</h1>
      <ContactForm
        action={saveContact.bind(null, id)}
        initial={{
          ...contact,
          phone: formatPhone(contact.phone),
          // Consent fields start on "No change"; the current status is shown alongside.
          email_consent_source: "",
          sms_consent_source: "",
        }}
        isEdit
        companies={companies}
        timeZones={timeZones}
        cancelHref={`/contacts/${id}`}
      />
    </main>
  );
}
