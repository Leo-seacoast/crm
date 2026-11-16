import { notFound } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { formatPhone } from "@/lib/phone";
import { saveCompany } from "../../actions";
import { CompanyForm } from "../../company-form";

export const metadata = { title: "Edit company · CRM" };

export default async function EditCompanyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const supabase = await createClient();
  const { data: company } = await supabase.from("companies").select("*").eq("id", id).maybeSingle();
  if (!company) notFound();

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold">Edit {company.name}</h1>
      <CompanyForm
        action={saveCompany.bind(null, id)}
        initial={{ ...company, phone: formatPhone(company.phone) }}
        cancelHref={`/companies/${id}`}
      />
    </main>
  );
}
