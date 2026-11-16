import { ExportButton } from "@/components/export-button";

export const metadata = { title: "Export · CRM" };

const EXPORTS = [
  { href: "/export/contacts", label: "Contacts", detail: "All active contacts, with types, company, address and consent." },
  { href: "/export/contacts?archived=1", label: "Archived contacts", detail: "Only archived contacts." },
  { href: "/export/companies", label: "Companies", detail: "All active companies." },
  { href: "/export/deals", label: "Deals", detail: "All active deals in every pipeline, with stage and linked contact/company." },
  { href: "/export/notes", label: "Notes", detail: "Every note (including archived ones), with what it's attached to." },
  { href: "/export/activity", label: "Activity log", detail: "The full history of every change and export." },
];

export default function ExportSettingsPage() {
  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 p-8">
      <div>
        <h1 className="text-2xl font-semibold">Export</h1>
        <p className="text-sm text-muted-foreground">
          Download your data as CSV files that open in Excel, Google Sheets or Numbers. Every export is recorded in
          the activity log. The Contacts, Companies and Deals pages also have an Export button that follows your
          current search and filters.
        </p>
      </div>
      <ul className="flex flex-col divide-y divide-border">
        {EXPORTS.map((e) => (
          <li key={e.href} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div>
              <div className="font-medium">{e.label}</div>
              <div className="text-sm text-muted-foreground">{e.detail}</div>
            </div>
            <ExportButton href={e.href} label="Download CSV" />
          </li>
        ))}
      </ul>
    </main>
  );
}
