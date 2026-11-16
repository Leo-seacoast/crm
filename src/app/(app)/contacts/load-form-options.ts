import "server-only";
import { createClient } from "@/lib/supabase/server";
import { timeZoneOptions } from "@/lib/records/schemas";

/** Lists used by the contact form's dropdowns. */
export async function loadContactFormOptions(includeCompanyId?: string | null) {
  const supabase = await createClient();
  const { data: companies } = await supabase
    .from("companies")
    .select("id, name")
    .is("archived_at", null)
    .order("name")
    .limit(1000);

  const list = companies ?? [];
  // Keep the contact's current company in the list even if it has since been archived.
  if (includeCompanyId && !list.some((c) => c.id === includeCompanyId)) {
    const { data: current } = await supabase.from("companies").select("id, name").eq("id", includeCompanyId).maybeSingle();
    if (current) list.unshift({ id: current.id, name: `${current.name} (archived)` });
  }

  return { companies: list, timeZones: timeZoneOptions() };
}
