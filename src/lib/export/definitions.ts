import "server-only";
import type { CsvColumn } from "@/lib/csv";
import {
  applyCompanyFilters,
  applyContactFilters,
  applyDealFilters,
  parseCompanyFilters,
  parseContactFilters,
  parseDealFilters,
} from "@/lib/records/list-filters";

/* eslint-disable @typescript-eslint/no-explicit-any */
// Export code reads rows generically (one shape per table), so it uses loose types.
type Row = Record<string, any>;
type Query = any;

export type Lookups = { people: Map<string, string> };

export type ExportDefinition = {
  table: "contacts" | "companies" | "deals" | "notes" | "activity_log";
  fileName: string;
  select: string;
  /** Applies the same filters as the matching list page; returns the filters used (for the log). */
  filter: (query: Query, params: Record<string, string>) => { query: Query; used: Record<string, unknown> };
  columns: (l: Lookups) => CsvColumn<Row>[];
};

const person = (l: Lookups, id: string | null) => (id ? (l.people.get(id) ?? id) : "");
const fullName = (c: Row | null) => (c ? [c.first_name, c.last_name].filter(Boolean).join(" ") || c.email || "" : "");

const standard = (l: Lookups): CsvColumn<Row>[] => [
  { header: "created_at", value: (r) => r.created_at },
  { header: "updated_at", value: (r) => r.updated_at },
  { header: "created_by", value: (r) => person(l, r.created_by) },
  { header: "owner", value: (r) => person(l, r.owner_id) },
  { header: "archived_at", value: (r) => r.archived_at },
];

const address: CsvColumn<Row>[] = [
  { header: "address_line1", value: (r) => r.address_line1 },
  { header: "address_line2", value: (r) => r.address_line2 },
  { header: "city", value: (r) => r.city },
  { header: "region", value: (r) => r.region },
  { header: "postal_code", value: (r) => r.postal_code },
  { header: "country", value: (r) => r.country },
];

export const EXPORTS: Record<string, ExportDefinition> = {
  contacts: {
    table: "contacts",
    fileName: "contacts",
    select: "*, company:companies(name)",
    filter: (query, params) => {
      const f = parseContactFilters(params);
      return { query: applyContactFilters(query, f), used: f };
    },
    columns: (l) => [
      { header: "id", value: (r) => r.id },
      { header: "first_name", value: (r) => r.first_name },
      { header: "last_name", value: (r) => r.last_name },
      { header: "email", value: (r) => r.email },
      { header: "phone", value: (r) => r.phone },
      { header: "types", value: (r) => r.types },
      { header: "company_id", value: (r) => r.company_id },
      { header: "company_name", value: (r) => r.company?.name },
      ...address,
      { header: "time_zone", value: (r) => r.time_zone },
      { header: "source", value: (r) => r.source },
      { header: "tags", value: (r) => r.tags },
      { header: "email_consent", value: (r) => r.email_consent },
      { header: "email_consent_at", value: (r) => r.email_consent_at },
      { header: "email_consent_how", value: (r) => r.email_consent_source },
      { header: "sms_consent", value: (r) => r.sms_consent },
      { header: "sms_consent_at", value: (r) => r.sms_consent_at },
      { header: "sms_consent_how", value: (r) => r.sms_consent_source },
      ...standard(l),
    ],
  },

  companies: {
    table: "companies",
    fileName: "companies",
    select: "*",
    filter: (query, params) => {
      const f = parseCompanyFilters(params);
      return { query: applyCompanyFilters(query, f), used: f };
    },
    columns: (l) => [
      { header: "id", value: (r) => r.id },
      { header: "name", value: (r) => r.name },
      { header: "website", value: (r) => r.website },
      { header: "email", value: (r) => r.email },
      { header: "phone", value: (r) => r.phone },
      ...address,
      { header: "tags", value: (r) => r.tags },
      ...standard(l),
    ],
  },

  deals: {
    table: "deals",
    fileName: "deals",
    select:
      "*, pipeline:pipelines(name), stage:pipeline_stages(name, kind), contact:contacts(first_name, last_name, email), company:companies(name)",
    filter: (query, params) => {
      const f = parseDealFilters(params);
      return { query: applyDealFilters(query, f), used: f };
    },
    columns: (l) => [
      { header: "id", value: (r) => r.id },
      { header: "title", value: (r) => r.title },
      { header: "pipeline", value: (r) => r.pipeline?.name },
      { header: "stage", value: (r) => r.stage?.name },
      { header: "stage_type", value: (r) => r.stage?.kind },
      { header: "value", value: (r) => r.value },
      { header: "currency", value: (r) => r.currency },
      { header: "expected_close_date", value: (r) => r.expected_close_date },
      { header: "closed_at", value: (r) => r.closed_at },
      { header: "contact_id", value: (r) => r.contact_id },
      { header: "contact_name", value: (r) => fullName(r.contact) },
      { header: "company_id", value: (r) => r.company_id },
      { header: "company_name", value: (r) => r.company?.name },
      { header: "pipeline_id", value: (r) => r.pipeline_id },
      { header: "stage_id", value: (r) => r.stage_id },
      ...standard(l),
    ],
  },

  notes: {
    table: "notes",
    fileName: "notes",
    select:
      "*, contact:contacts(first_name, last_name, email), company:companies(name), deal:deals(title)",
    filter: (query) => ({ query, used: { all: true } }),
    columns: (l) => [
      { header: "id", value: (r) => r.id },
      { header: "created_at", value: (r) => r.created_at },
      { header: "author", value: (r) => person(l, r.created_by) || "Imported / system" },
      { header: "body", value: (r) => r.body },
      { header: "pinned", value: (r) => r.pinned },
      { header: "on", value: (r) => (r.contact_id ? "contact" : r.company_id ? "company" : "deal") },
      { header: "contact_id", value: (r) => r.contact_id },
      { header: "contact_name", value: (r) => fullName(r.contact) },
      { header: "company_id", value: (r) => r.company_id },
      { header: "company_name", value: (r) => r.company?.name },
      { header: "deal_id", value: (r) => r.deal_id },
      { header: "deal_title", value: (r) => r.deal?.title },
      { header: "updated_at", value: (r) => r.updated_at },
      { header: "archived_at", value: (r) => r.archived_at },
    ],
  },

  activity: {
    table: "activity_log",
    fileName: "activity-log",
    select: "*",
    filter: (query) => ({ query, used: { all: true } }),
    columns: (l) => [
      { header: "id", value: (r) => r.id },
      { header: "occurred_at", value: (r) => r.occurred_at },
      { header: "actor_type", value: (r) => r.actor_type },
      { header: "actor", value: (r) => person(l, r.actor_id) },
      { header: "action", value: (r) => r.action },
      { header: "table", value: (r) => r.table_name },
      { header: "record_id", value: (r) => r.record_id },
      { header: "changes", value: (r) => r.changes },
      { header: "context", value: (r) => r.context },
    ],
  },
};
