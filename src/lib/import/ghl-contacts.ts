/**
 * GHL contact import: recognising GHL's column names, cleaning each row, and
 * finding duplicates — all BEFORE anything is saved. Runs in the browser for
 * the preview; the server checks every row again (see import-row-schema.ts).
 */
import { normalizePhone } from "@/lib/phone";
import { parseGhlDate } from "./dates";

// ---------------------------------------------------------------------------
// Where a GHL column can go
// ---------------------------------------------------------------------------
export const TARGETS = {
  ghl_id: "GHL contact ID (matches re-imports)",
  full_name: "Full name (split into first/last)",
  first_name: "First name",
  last_name: "Last name",
  email: "Email",
  phone: "Phone",
  company_name: "Company (business name)",
  tags: "Tags",
  created_at: "Date created",
  address_line1: "Address line 1",
  address_line2: "Address line 2",
  city: "City",
  region: "State / region",
  postal_code: "Postal code",
  country: "Country",
  time_zone: "Time zone",
  source: "Source",
  dnd_all: "Do Not Disturb (all)",
  dnd_email: "Do Not Disturb (email)",
  dnd_sms: "Do Not Disturb (SMS)",
  extra: "Keep as extra field",
  ignore: "Don't import",
} as const;
export type Target = keyof typeof TARGETS;
export type Mapping = Record<string, Target>;

const norm = (h: string) => h.toLowerCase().replace(/\(.*?\)/g, "").replace(/[^a-z0-9]/g, "");

const KNOWN: Record<string, Target> = {
  contactid: "ghl_id", ghlid: "ghl_id", ghlcontactid: "ghl_id", id: "ghl_id",
  contactname: "full_name", name: "full_name", fullname: "full_name",
  firstname: "first_name", lastname: "last_name",
  email: "email", emailaddress: "email",
  phone: "phone", phonenumber: "phone", mobile: "phone", mobilephone: "phone",
  businessname: "company_name", companyname: "company_name", company: "company_name",
  tags: "tags",
  created: "created_at", datecreated: "created_at", dateadded: "created_at", createdon: "created_at",
  address: "address_line1", address1: "address_line1", streetaddress: "address_line1", addressline1: "address_line1",
  address2: "address_line2", addressline2: "address_line2",
  city: "city",
  state: "region", region: "region", province: "region",
  postalcode: "postal_code", zip: "postal_code", zipcode: "postal_code", postcode: "postal_code",
  country: "country",
  timezone: "time_zone",
  source: "source", contactsource: "source",
  dnd: "dnd_all", donotdisturb: "dnd_all",
  dndemail: "dnd_email", emaildnd: "dnd_email",
  dndsms: "dnd_sms", smsdnd: "dnd_sms",
};

/** Guesses where each GHL column goes. Anything unrecognised is kept as an extra field. */
export function guessMapping(headers: string[]): Mapping {
  const mapping: Mapping = {};
  const used = new Set<Target>();
  for (const h of headers) {
    const t = KNOWN[norm(h)];
    // Each standard field is used once; a second match is kept as an extra field instead.
    if (t && !used.has(t)) {
      mapping[h] = t;
      used.add(t);
    } else {
      mapping[h] = norm(h) === "" ? "ignore" : "extra";
    }
  }
  // If GHL gave separate first/last names, don't also split a full-name column.
  if (used.has("first_name") || used.has("last_name")) {
    for (const h of headers) if (mapping[h] === "full_name") mapping[h] = "extra";
  }
  return mapping;
}

// ---------------------------------------------------------------------------
// Cleaning a row
// ---------------------------------------------------------------------------
export type ImportContact = {
  ghl_id: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  company_name: string | null;
  tags: string[];
  created_at: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  region: string | null;
  postal_code: string | null;
  country: string | null;
  time_zone: string | null;
  source: string | null;
  email_consent: "unknown" | "opted_out";
  sms_consent: "unknown" | "opted_out";
  extra_fields: Record<string, string>;
};

export type CleanedRow = {
  row: number; // spreadsheet row number (header = row 1)
  contact: ImportContact | null; // null = can't be imported
  problems: string[]; // why it can't be imported
  warnings: string[]; // imported, but something was left out
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const TRUTHY = new Set(["true", "yes", "y", "1", "dnd", "active", "on", "enabled", "x"]);
const TIME_ZONES = new Set(Intl.supportedValuesOf("timeZone"));
export const MAX_EXTRA_VALUE = 1000;

const LIMITS: Partial<Record<keyof ImportContact, number>> = {
  first_name: 100, last_name: 100, company_name: 200, address_line1: 200, address_line2: 200,
  city: 100, region: 100, postal_code: 20, country: 100, source: 100,
};

const TZ_ALIASES: Record<string, string> = {
  eastern: "America/New_York", easterntime: "America/New_York", est: "America/New_York", edt: "America/New_York",
  et: "America/New_York", useastern: "America/New_York",
  central: "America/Chicago", centraltime: "America/Chicago", cst: "America/Chicago", cdt: "America/Chicago",
  ct: "America/Chicago", uscentral: "America/Chicago",
  mountain: "America/Denver", mountaintime: "America/Denver", mst: "America/Denver", mdt: "America/Denver",
  mt: "America/Denver", usmountain: "America/Denver", arizona: "America/Phoenix",
  pacific: "America/Los_Angeles", pacifictime: "America/Los_Angeles", pst: "America/Los_Angeles",
  pdt: "America/Los_Angeles", pt: "America/Los_Angeles", uspacific: "America/Los_Angeles",
  alaska: "America/Anchorage", alaskatime: "America/Anchorage", akst: "America/Anchorage",
  hawaii: "Pacific/Honolulu", hawaiitime: "Pacific/Honolulu", hst: "Pacific/Honolulu",
  atlantic: "America/Halifax", atlantictime: "America/Halifax",
  utc: "UTC", gmt: "UTC",
};

/**
 * Turns the ways exports write time zones into a real one:
 * "America/New_York", "Eastern Time", "EST", "(GMT-05:00) America/New_York".
 */
export function resolveTimeZone(value: string): string | null {
  const v = value.trim();
  if (TIME_ZONES.has(v)) return v;
  const embedded = v.match(/[A-Za-z]+\/[A-Za-z_]+(?:\/[A-Za-z_]+)?/)?.[0];
  if (embedded && TIME_ZONES.has(embedded)) return embedded;
  const key = v.toLowerCase().replace(/\(.*?\)/g, "").replace(/standard|daylight|zone/g, "").replace(/[^a-z]/g, "");
  return TZ_ALIASES[key] ?? null;
}

/** "Mary Ann Smith" -> first "Mary Ann", last "Smith". */
export function splitName(full: string): { first: string | null; last: string | null } {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: null, last: null };
  if (parts.length === 1) return { first: parts[0], last: null };
  return { first: parts.slice(0, -1).join(" "), last: parts[parts.length - 1] };
}

export function cleanRow(
  raw: Record<string, string | undefined>,
  mapping: Mapping,
  rowNumber: number,
  options: { dateTimeZone?: string } = {},
): CleanedRow {
  const problems: string[] = [];
  const warnings: string[] = [];
  const c: ImportContact = {
    ghl_id: null,
    first_name: null, last_name: null, email: null, phone: null, company_name: null, tags: [],
    created_at: null, address_line1: null, address_line2: null, city: null, region: null,
    postal_code: null, country: null, time_zone: null, source: null,
    email_consent: "unknown", sms_consent: "unknown", extra_fields: {},
  };

  const text = (field: keyof ImportContact, value: string) => {
    const limit = LIMITS[field] ?? 200;
    if (value.length > limit) warnings.push(`${field.replace(/_/g, " ")} shortened to ${limit} characters`);
    (c as Record<string, unknown>)[field] = value.slice(0, limit);
  };

  for (const [header, target] of Object.entries(mapping)) {
    const value = (raw[header] ?? "").trim();
    if (target === "ignore" || value === "") continue;

    switch (target) {
      case "ghl_id":
        if (value.length <= 100) c.ghl_id = value;
        else warnings.push("GHL contact ID too long — left blank");
        break;
      case "full_name": {
        const { first, last } = splitName(value);
        if (first) text("first_name", first);
        if (last) text("last_name", last);
        break;
      }
      case "first_name":
      case "last_name":
      case "company_name":
      case "address_line1":
      case "address_line2":
      case "city":
      case "region":
      case "postal_code":
      case "country":
      case "source":
        text(target, value);
        break;
      case "email":
        if (EMAIL_RE.test(value) && value.length <= 320) c.email = value.toLowerCase();
        else warnings.push(`Email "${value.slice(0, 60)}" isn't valid — left blank`);
        break;
      case "phone": {
        const r = normalizePhone(value);
        if (r.ok && r.value) c.phone = r.value;
        else warnings.push(`Phone "${value.slice(0, 30)}" isn't valid — left blank`);
        break;
      }
      case "tags":
        c.tags = [...new Set(value.split(",").map((t) => t.trim().slice(0, 50)).filter(Boolean))].slice(0, 50);
        break;
      case "created_at": {
        const iso = parseGhlDate(value, options.dateTimeZone);
        if (iso) c.created_at = iso;
        else warnings.push(`Date "${value.slice(0, 30)}" not recognised — today's date used`);
        break;
      }
      case "time_zone": {
        const tz = resolveTimeZone(value);
        if (tz) c.time_zone = tz;
        else warnings.push(`Time zone "${value.slice(0, 40)}" not recognised — left blank`);
        break;
      }
      case "dnd_all":
        if (TRUTHY.has(value.toLowerCase())) {
          c.email_consent = "opted_out";
          c.sms_consent = "opted_out";
        }
        break;
      case "dnd_email":
        if (TRUTHY.has(value.toLowerCase())) c.email_consent = "opted_out";
        break;
      case "dnd_sms":
        if (TRUTHY.has(value.toLowerCase())) c.sms_consent = "opted_out";
        break;
      case "extra": {
        const key = header.trim().slice(0, 100);
        if (value.length > MAX_EXTRA_VALUE) warnings.push(`"${key}" shortened to ${MAX_EXTRA_VALUE} characters`);
        c.extra_fields[key] = value.slice(0, MAX_EXTRA_VALUE);
        break;
      }
    }
  }

  // Keep the whole extra-fields bundle within the database's size limit.
  let size = JSON.stringify(c.extra_fields).length;
  if (size > 18000) {
    for (const key of Object.keys(c.extra_fields).reverse()) {
      if (size <= 18000) break;
      size -= key.length + c.extra_fields[key].length + 6;
      delete c.extra_fields[key];
    }
    warnings.push("Some extra fields were left out (too much data for one contact)");
  }

  if (!c.first_name && !c.last_name && !c.email && !c.phone) {
    problems.push("No name, email or phone");
  }

  return { row: rowNumber, contact: problems.length ? null : c, problems, warnings };
}

// ---------------------------------------------------------------------------
// Duplicates and matching
// ---------------------------------------------------------------------------
export type Existing = { id: string; email: string | null; phone: string | null; ghl_id: string | null; name: string };
export type ExistingMode = "fill_blanks" | "skip";

export type PlannedRow = CleanedRow & {
  action: "create" | "update" | "skip";
  targetId?: string;
  matchedName?: string;
  reason?: string; // why skipped
};

/**
 * Decides what happens to each row:
 * - duplicates INSIDE the file (same GHL ID, email or phone): the first wins, later ones are skipped;
 * - rows matching an existing CRM contact: fill in blanks, or skip. The GHL ID is the
 *   surest match, then email, then phone;
 * - rows whose email and phone point to two different existing contacts: skipped (needs a human).
 */
export function planRows(rows: CleanedRow[], existing: Existing[], mode: ExistingMode): PlannedRow[] {
  const byGhl = new Map<string, Existing>();
  const byEmail = new Map<string, Existing>();
  const byPhone = new Map<string, Existing>();
  for (const e of existing) {
    if (e.ghl_id) byGhl.set(e.ghl_id, e);
    if (e.email) byEmail.set(e.email.toLowerCase(), e);
    if (e.phone) byPhone.set(e.phone, e);
  }

  const seen = { ghl: new Map<string, number>(), email: new Map<string, number>(), phone: new Map<string, number>() };

  return rows.map((r): PlannedRow => {
    if (!r.contact) return { ...r, action: "skip", reason: r.problems.join("; ") };
    const { ghl_id, email, phone } = r.contact;

    const dup =
      (ghl_id && seen.ghl.has(ghl_id) && { what: "GHL ID", row: seen.ghl.get(ghl_id) }) ||
      (email && seen.email.has(email) && { what: "email", row: seen.email.get(email) }) ||
      (phone && seen.phone.has(phone) && { what: "phone", row: seen.phone.get(phone) });
    if (dup) return { ...r, action: "skip", reason: `Same ${dup.what} as row ${dup.row} in this file` };
    if (ghl_id) seen.ghl.set(ghl_id, r.row);
    if (email) seen.email.set(email, r.row);
    if (phone) seen.phone.set(phone, r.row);

    const g = ghl_id ? byGhl.get(ghl_id) : undefined;
    const a = email ? byEmail.get(email) : undefined;
    const b = phone ? byPhone.get(phone) : undefined;
    if (!g && a && b && a.id !== b.id) {
      return { ...r, action: "skip", reason: `Email matches ${a.name} but phone matches ${b.name} — check by hand` };
    }
    const match = g ?? a ?? b;
    if (match) {
      return mode === "skip"
        ? { ...r, action: "skip", reason: `Already in the CRM (${match.name})`, matchedName: match.name }
        : { ...r, action: "update", targetId: match.id, matchedName: match.name };
    }
    return { ...r, action: "create" };
  });
}

type LookupKeys = { emails: string[]; phones: string[]; ghlIds: string[] };

/**
 * Splits the values to look up into batches with at most `max` values in total,
 * so no single database answer can exceed its 1,000-record cap.
 * (Each value matches at most one active contact.)
 */
export function lookupBatches(keys: LookupKeys, max: number): LookupKeys[] {
  const all: [keyof LookupKeys, string][] = [
    ...keys.ghlIds.map((v) => ["ghlIds", v] as [keyof LookupKeys, string]),
    ...keys.emails.map((v) => ["emails", v] as [keyof LookupKeys, string]),
    ...keys.phones.map((v) => ["phones", v] as [keyof LookupKeys, string]),
  ];
  const batches: LookupKeys[] = [];
  for (let i = 0; i < all.length; i += max) {
    const b: LookupKeys = { emails: [], phones: [], ghlIds: [] };
    for (const [kind, v] of all.slice(i, i + max)) b[kind].push(v);
    batches.push(b);
  }
  return batches;
}

export type PlanSummary ={ create: number; update: number; skip: number; warnings: number; companies: number };

export function summarise(plan: PlannedRow[]): PlanSummary {
  const companies = new Set<string>();
  let create = 0, update = 0, skip = 0, warnings = 0;
  for (const p of plan) {
    if (p.action === "create") create++;
    else if (p.action === "update") update++;
    else skip++;
    if (p.action !== "skip" && p.warnings.length) warnings++;
    if (p.action !== "skip" && p.contact?.company_name) companies.add(p.contact.company_name.toLowerCase());
  }
  return { create, update, skip, warnings, companies: companies.size };
}
