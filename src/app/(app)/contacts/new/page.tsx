import { z } from "zod";
import { saveContact } from "../actions";
import { ContactForm } from "../contact-form";
import { loadContactFormOptions } from "../load-form-options";

export const metadata = { title: "Add contact · CRM" };

export default async function NewContactPage({
  searchParams,
}: {
  searchParams: Promise<{ company?: string }>;
}) {
  const { company } = await searchParams;
  const companyId = z.uuid().safeParse(company).success ? company! : null;
  const { companies, timeZones } = await loadContactFormOptions();

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold">Add contact</h1>
      <ContactForm
        action={saveContact.bind(null, null)}
        initial={{ company_id: companyId ?? "" }}
        isEdit={false}
        companies={companies}
        timeZones={timeZones}
        cancelHref={companyId ? `/companies/${companyId}` : "/contacts"}
      />
    </main>
  );
}
