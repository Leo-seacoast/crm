import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { pageNumber } from "@/lib/search";
import { formatPhone } from "@/lib/phone";
import { CONTACT_TYPE_LABELS, CONTACT_TYPES } from "@/lib/records/schemas";
import { applyContactFilters, filtersToQuery, parseContactFilters } from "@/lib/records/list-filters";
import { requireUser } from "@/lib/auth/session";
import { ExportButton } from "@/components/export-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pagination } from "@/components/pagination";
import { selectClass } from "@/components/form-field";
import { cn } from "@/lib/utils";

export const metadata = { title: "Contacts · CRM" };
const PAGE_SIZE = 50;

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const filters = parseContactFilters(params);
  const { q, type, archived: showArchived } = filters;
  const page = pageNumber(params.page);
  const user = await requireUser();

  const supabase = await createClient();
  const base = supabase
    .from("contacts")
    .select("id, first_name, last_name, email, phone, types, archived_at, company:companies(id, name)", {
      count: "exact",
    })
    .order("last_name", { ascending: true, nullsFirst: false })
    .order("first_name", { ascending: true, nullsFirst: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  // Same rules as the CSV export. Phone searches match the digits however they were typed.
  const { data: contacts, count, error } = await applyContactFilters(base, filters);

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 p-8">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">{showArchived ? "Archived contacts" : "Contacts"}</h1>
        <div className="flex gap-2">
          {user.role === "admin" && <ExportButton href={`/export/contacts${filtersToQuery(filters)}`} />}
          <Button asChild>
            <Link href="/contacts/new">Add contact</Link>
          </Button>
        </div>
      </div>

      <form className="flex flex-wrap items-center gap-3" role="search">
        <Input
          name="q"
          defaultValue={params.q ?? ""}
          placeholder="Search name, email or phone"
          className="max-w-sm"
        />
        <select name="type" defaultValue={type ?? ""} className={cn(selectClass, "w-44")} aria-label="Type">
          <option value="">All types</option>
          {CONTACT_TYPES.map((t) => (
            <option key={t} value={t}>
              {CONTACT_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="archived" value="1" defaultChecked={showArchived} /> Show archived
        </label>
        <Button type="submit" variant="outline">
          Search
        </Button>
      </form>

      {error && <p className="text-sm text-destructive">Could not load contacts. Please refresh.</p>}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Company</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {contacts?.map((c) => (
            <TableRow key={c.id}>
              <TableCell>
                <Link href={`/contacts/${c.id}`} className="font-medium hover:underline">
                  {[c.first_name, c.last_name].filter(Boolean).join(" ") || c.email || formatPhone(c.phone)}
                </Link>
                {c.archived_at && (
                  <Badge variant="outline" className="ml-2">
                    Archived
                  </Badge>
                )}
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  {c.types.map((t) => (
                    <Badge key={t} variant="secondary">
                      {CONTACT_TYPE_LABELS[t]}
                    </Badge>
                  ))}
                </div>
              </TableCell>
              <TableCell>{c.email}</TableCell>
              <TableCell>{formatPhone(c.phone)}</TableCell>
              <TableCell>
                {c.company && (
                  <Link href={`/companies/${c.company.id}`} className="hover:underline">
                    {c.company.name}
                  </Link>
                )}
              </TableCell>
            </TableRow>
          ))}
          {contacts?.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                {q || type ? "No contacts match your search." : "No contacts yet."}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <Pagination page={page} pageSize={PAGE_SIZE} total={count ?? 0} params={params} basePath="/contacts" />
    </main>
  );
}
