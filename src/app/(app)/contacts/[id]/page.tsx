import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/session";
import { formatPhone } from "@/lib/phone";
import { CONSENT_LABELS, CONTACT_TYPE_LABELS, type ConsentStatus } from "@/lib/records/schemas";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArchiveButton } from "@/components/archive-button";
import { RecordHistory } from "@/components/record-history";
import { RelatedDeals } from "@/components/related-deals";
import { NotesSection } from "@/components/notes/notes-section";
import { archiveContact } from "../actions";

export default async function ContactPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const user = await requireUser();
  const supabase = await createClient();
  const { data: c } = await supabase
    .from("contacts")
    .select("*, company:companies(id, name, archived_at)")
    .eq("id", id)
    .maybeSingle();
  if (!c) notFound();

  const archived = !!c.archived_at;
  const name = [c.first_name, c.last_name].filter(Boolean).join(" ") || c.email || formatPhone(c.phone);
  const address = [
    c.address_line1,
    c.address_line2,
    [c.city, c.region, c.postal_code].filter(Boolean).join(", "),
    c.country,
  ].filter(Boolean);

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-8 p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/contacts" className="text-sm text-muted-foreground hover:underline">
            ← Contacts
          </Link>
          <h1 className="mt-1 text-2xl font-semibold">
            {name}
            {archived && (
              <Badge variant="outline" className="ml-3 align-middle">
                Archived
              </Badge>
            )}
          </h1>
          <div className="mt-2 flex flex-wrap gap-1">
            {c.types.map((t) => (
              <Badge key={t} variant="secondary">
                {CONTACT_TYPE_LABELS[t]}
              </Badge>
            ))}
          </div>
        </div>
        <div className="flex items-start gap-3">
          {(!archived || user.role === "admin") && (
            <Button variant="outline" asChild>
              <Link href={`/contacts/${id}/edit`}>Edit</Link>
            </Button>
          )}
          {!archived || user.role === "admin" ? (
            <ArchiveButton archived={archived} action={archiveContact.bind(null, id, !archived)} />
          ) : (
            <p className="max-w-48 text-xs text-muted-foreground">Only an admin can restore this contact.</p>
          )}
        </div>
      </div>

      <dl className="grid gap-4 text-sm sm:grid-cols-2">
        <Detail label="Email">{c.email && <a href={`mailto:${c.email}`}>{c.email}</a>}</Detail>
        <Detail label="Phone">{c.phone && <a href={`tel:${c.phone}`}>{formatPhone(c.phone)}</a>}</Detail>
        <Detail label="Company">
          {c.company && (
            <Link href={`/companies/${c.company.id}`} className="hover:underline">
              {c.company.name}
              {c.company.archived_at ? " (archived)" : ""}
            </Link>
          )}
        </Detail>
        <Detail label="Time zone">{c.time_zone?.replace(/_/g, " ")}</Detail>
        <Detail label="Address">
          {address.map((line) => (
            <div key={line}>{line}</div>
          ))}
        </Detail>
        <Detail label="Source">{c.source}</Detail>
        <Detail label="Tags">
          <div className="flex flex-wrap gap-1">
            {c.tags.map((t) => (
              <Badge key={t} variant="outline">
                {t}
              </Badge>
            ))}
          </div>
        </Detail>
      </dl>

      <section className="grid gap-4 rounded-lg border border-border p-4 text-sm sm:grid-cols-2">
        <h2 className="text-lg font-semibold sm:col-span-2">Marketing consent</h2>
        <Consent label="Email" status={c.email_consent} at={c.email_consent_at} source={c.email_consent_source} />
        <Consent label="SMS" status={c.sms_consent} at={c.sms_consent_at} source={c.sms_consent_source} />
      </section>

      <NotesSection kind="contact" recordId={id} readOnly={archived} />

      <RelatedDeals by="contact_id" id={id} allowAdd={!archived} />

      <RecordHistory table="contacts" recordId={id} />
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

function Consent({
  label,
  status,
  at,
  source,
}: {
  label: string;
  status: ConsentStatus;
  at: string | null;
  source: string | null;
}) {
  const color =
    status === "opted_in"
      ? "text-green-700 dark:text-green-400"
      : status === "opted_out"
        ? "text-destructive"
        : "text-muted-foreground";
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`mt-1 font-medium ${color}`}>{CONSENT_LABELS[status]}</div>
      {at && (
        <div className="text-xs text-muted-foreground">
          {new Date(at).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
          {source ? ` · ${source}` : ""}
        </div>
      )}
    </div>
  );
}
