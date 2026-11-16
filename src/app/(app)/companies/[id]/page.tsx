import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/session";
import { formatPhone } from "@/lib/phone";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArchiveButton } from "@/components/archive-button";
import { RecordHistory } from "@/components/record-history";
import { RelatedDeals } from "@/components/related-deals";
import { CONTACT_TYPE_LABELS } from "@/lib/records/schemas";
import { archiveCompany } from "../actions";

export default async function CompanyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const user = await requireUser();
  const supabase = await createClient();
  const { data: company } = await supabase.from("companies").select("*").eq("id", id).maybeSingle();
  if (!company) notFound();

  const { data: contacts } = await supabase
    .from("contacts")
    .select("id, first_name, last_name, email, types")
    .eq("company_id", id)
    .is("archived_at", null)
    .order("last_name");

  const archived = !!company.archived_at;
  const address = [
    company.address_line1,
    company.address_line2,
    [company.city, company.region, company.postal_code].filter(Boolean).join(", "),
    company.country,
  ].filter(Boolean);

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-8 p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/companies" className="text-sm text-muted-foreground hover:underline">
            ← Companies
          </Link>
          <h1 className="mt-1 text-2xl font-semibold">
            {company.name}
            {archived && (
              <Badge variant="outline" className="ml-3 align-middle">
                Archived
              </Badge>
            )}
          </h1>
        </div>
        <div className="flex items-start gap-3">
          {(!archived || user.role === "admin") && (
            <Button variant="outline" asChild>
              <Link href={`/companies/${id}/edit`}>Edit</Link>
            </Button>
          )}
          {!archived || user.role === "admin" ? (
            <ArchiveButton archived={archived} action={archiveCompany.bind(null, id, !archived)} />
          ) : (
            <p className="max-w-48 text-xs text-muted-foreground">Only an admin can restore this company.</p>
          )}
        </div>
      </div>

      <dl className="grid gap-4 text-sm sm:grid-cols-2">
        <Detail label="Website">
          {company.website &&
            (/^https?:\/\//i.test(company.website) ? (
              <a href={company.website} target="_blank" rel="noopener noreferrer nofollow" className="hover:underline">
                {company.website}
              </a>
            ) : (
              company.website
            ))}
        </Detail>
        <Detail label="Email">{company.email && <a href={`mailto:${company.email}`}>{company.email}</a>}</Detail>
        <Detail label="Phone">{formatPhone(company.phone)}</Detail>
        <Detail label="Address">
          {address.map((line) => (
            <div key={line}>{line}</div>
          ))}
        </Detail>
        <Detail label="Tags">
          <div className="flex flex-wrap gap-1">
            {company.tags.map((t) => (
              <Badge key={t} variant="secondary">
                {t}
              </Badge>
            ))}
          </div>
        </Detail>
      </dl>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Contacts ({contacts?.length ?? 0})</h2>
          {!archived && (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/contacts/new?company=${id}`}>Add contact to this company</Link>
            </Button>
          )}
        </div>
        {contacts?.length === 0 && <p className="text-sm text-muted-foreground">No contacts linked yet.</p>}
        <ul className="flex flex-col divide-y divide-border text-sm">
          {contacts?.map((c) => (
            <li key={c.id} className="flex items-center justify-between py-2">
              <Link href={`/contacts/${c.id}`} className="font-medium hover:underline">
                {[c.first_name, c.last_name].filter(Boolean).join(" ") || c.email || "Unnamed contact"}
              </Link>
              <span className="flex gap-1">
                {c.types.map((t) => (
                  <Badge key={t} variant="secondary">
                    {CONTACT_TYPE_LABELS[t]}
                  </Badge>
                ))}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <RelatedDeals by="company_id" id={id} allowAdd={!archived} />

      <RecordHistory table="companies" recordId={id} />
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
