import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { NameLookup } from "./format";

/** Looks up readable names for record ids mentioned in history (stages, pipelines, contacts, companies). */
export async function loadNames(ids: string[]): Promise<NameLookup> {
  const map = new Map<string, string>();
  if (ids.length === 0) return (id) => map.get(id);

  const supabase = await createClient();
  const [stages, pipelines, contacts, companies] = await Promise.all([
    supabase.from("pipeline_stages").select("id, name").in("id", ids),
    supabase.from("pipelines").select("id, name").in("id", ids),
    supabase.from("contacts").select("id, first_name, last_name, email").in("id", ids),
    supabase.from("companies").select("id, name").in("id", ids),
  ]);
  for (const r of stages.data ?? []) map.set(r.id, r.name);
  for (const r of pipelines.data ?? []) map.set(r.id, r.name);
  for (const r of companies.data ?? []) map.set(r.id, r.name);
  for (const r of contacts.data ?? [])
    map.set(r.id, [r.first_name, r.last_name].filter(Boolean).join(" ") || r.email || "Contact");

  return (id) => map.get(id);
}
