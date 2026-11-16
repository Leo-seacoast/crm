import { z } from "zod";
import { cleanSearch, phoneDigits } from "@/lib/search";
import { CONTACT_TYPES, type ContactType } from "./schemas";

/**
 * Search/filter rules shared by the list pages and the CSV exports,
 * so an export always contains exactly what the list shows.
 */

type Params = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

// Minimal shape of a database query we can add filters to.
// (Method syntax keeps this compatible with the Supabase query builder.)
interface Filterable<Q> {
  is(column: string, value: null): Q;
  not(column: string, operator: string, value: null): Q;
  ilike(column: string, pattern: string): Q;
  contains(column: string, value: string[]): Q;
  eq(column: string, value: string): Q;
}

// ---- Contacts --------------------------------------------------------------
export type ContactFilters = { q: string; type: ContactType | null; archived: boolean };

export function parseContactFilters(params: Params): ContactFilters {
  const type = first(params.type);
  return {
    q: cleanSearch(first(params.q)),
    type: CONTACT_TYPES.includes(type as ContactType) ? (type as ContactType) : null,
    archived: first(params.archived) === "1",
  };
}

export function applyContactFilters<Q extends Filterable<Q>>(query: Q, f: ContactFilters): Q {
  let q = f.archived ? query.not("archived_at", "is", null) : query.is("archived_at", null);
  if (f.type) q = q.contains("types", [f.type]);
  if (f.q) {
    const digits = phoneDigits(f.q);
    q = digits ? q.ilike("phone", `%${digits}%`) : q.ilike("search_text", `%${f.q}%`);
  }
  return q;
}

// ---- Companies -------------------------------------------------------------
export type CompanyFilters = { q: string; archived: boolean };

export function parseCompanyFilters(params: Params): CompanyFilters {
  return { q: cleanSearch(first(params.q)), archived: first(params.archived) === "1" };
}

export function applyCompanyFilters<Q extends Filterable<Q>>(query: Q, f: CompanyFilters): Q {
  let q = f.archived ? query.not("archived_at", "is", null) : query.is("archived_at", null);
  if (f.q) q = q.ilike("search_text", `%${f.q}%`);
  return q;
}

// ---- Deals -----------------------------------------------------------------
export type DealFilters = { pipeline: string | null; archived: boolean };

export function parseDealFilters(params: Params): DealFilters {
  const pipeline = first(params.pipeline);
  return {
    pipeline: z.uuid().safeParse(pipeline).success ? pipeline! : null,
    archived: first(params.archived) === "1",
  };
}

export function applyDealFilters<Q extends Filterable<Q>>(query: Q, f: DealFilters): Q {
  let q = f.archived ? query.not("archived_at", "is", null) : query.is("archived_at", null);
  if (f.pipeline) q = q.eq("pipeline_id", f.pipeline);
  return q;
}

/** Turns filters back into a query string, e.g. for the Export link. */
export function filtersToQuery(f: Record<string, string | boolean | null>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) {
    if (v === true) sp.set(k, "1");
    else if (typeof v === "string" && v) sp.set(k, v);
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}
