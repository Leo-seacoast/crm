import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { cleanSearch, pageNumber } from "@/lib/search";
import { formatPhone } from "@/lib/phone";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pagination } from "@/components/pagination";

export const metadata = { title: "Companies · CRM" };
const PAGE_SIZE = 50;

export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const q = cleanSearch(params.q);
  const showArchived = params.archived === "1";
  const page = pageNumber(params.page);

  const supabase = await createClient();
  let query = supabase
    .from("companies")
    .select("id, name, website, email, phone, city, archived_at", { count: "exact" })
    .order("name", { ascending: true })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  query = showArchived ? query.not("archived_at", "is", null) : query.is("archived_at", null);
  if (q) query = query.ilike("search_text", `%${q}%`);

  const { data: companies, count, error } = await query;

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 p-8">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">{showArchived ? "Archived companies" : "Companies"}</h1>
        <Button asChild>
          <Link href="/companies/new">Add company</Link>
        </Button>
      </div>

      <form className="flex flex-wrap items-center gap-3" role="search">
        <Input name="q" defaultValue={params.q ?? ""} placeholder="Search name, email or website" className="max-w-sm" />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="archived" value="1" defaultChecked={showArchived} /> Show archived
        </label>
        <Button type="submit" variant="outline">
          Search
        </Button>
      </form>

      {error && <p className="text-sm text-destructive">Could not load companies. Please refresh.</p>}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>City</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {companies?.map((c) => (
            <TableRow key={c.id}>
              <TableCell>
                <Link href={`/companies/${c.id}`} className="font-medium hover:underline">
                  {c.name}
                </Link>
                {c.archived_at && (
                  <Badge variant="outline" className="ml-2">
                    Archived
                  </Badge>
                )}
              </TableCell>
              <TableCell>{c.email}</TableCell>
              <TableCell>{formatPhone(c.phone)}</TableCell>
              <TableCell>{c.city}</TableCell>
            </TableRow>
          ))}
          {companies?.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                {q ? "No companies match your search." : "No companies yet."}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <Pagination page={page} pageSize={PAGE_SIZE} total={count ?? 0} params={params} basePath="/companies" />
    </main>
  );
}
