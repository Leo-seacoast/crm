import { saveCompany } from "../actions";
import { CompanyForm } from "../company-form";

export const metadata = { title: "Add company · CRM" };

export default function NewCompanyPage() {
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold">Add company</h1>
      <CompanyForm action={saveCompany.bind(null, null)} initial={{}} cancelHref="/companies" />
    </main>
  );
}
