"use server";

import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { cleanSearch, phoneDigits } from "@/lib/search";
import { formatPhone } from "@/lib/phone";

export type LookupResult = { id: string; label: string; detail?: string };

/** Search-as-you-type for choosing a contact or company in a form. Max 10 results. */
export async function lookupRecords(kind: "contact" | "company", search: string): Promise<LookupResult[]> {
  await requireUser();
  const q = cleanSearch(search);
  if (q.length < 2) return [];
  const supabase = await createClient();

  if (kind === "company") {
    const { data } = await supabase
      .from("companies")
      .select("id, name, city")
      .is("archived_at", null)
      .ilike("search_text", `%${q}%`)
      .order("name")
      .limit(10);
    return (data ?? []).map((c) => ({ id: c.id, label: c.name, detail: c.city ?? undefined }));
  }

  const digits = phoneDigits(q);
  let query = supabase
    .from("contacts")
    .select("id, first_name, last_name, email, phone")
    .is("archived_at", null)
    .order("last_name", { nullsFirst: false })
    .limit(10);
  query = digits ? query.ilike("phone", `%${digits}%`) : query.ilike("search_text", `%${q}%`);
  const { data } = await query;
  return (data ?? []).map((c) => ({
    id: c.id,
    label: [c.first_name, c.last_name].filter(Boolean).join(" ") || c.email || formatPhone(c.phone),
    detail: c.email ?? formatPhone(c.phone) ?? undefined,
  }));
}
