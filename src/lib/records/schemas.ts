import { z } from "zod";
import { normalizePhone } from "@/lib/phone";
import { parseMoney } from "@/lib/money";

// ---------------------------------------------------------------------------
// Labels shown on screen
// ---------------------------------------------------------------------------
export const CONTACT_TYPES = ["lead", "client", "owner", "guest", "vendor", "partner"] as const;
export type ContactType = (typeof CONTACT_TYPES)[number];

export const CONTACT_TYPE_LABELS: Record<ContactType, string> = {
  lead: "Lead",
  client: "Client",
  owner: "Property owner",
  guest: "Guest",
  vendor: "Vendor",
  partner: "Partner",
};

export const CONSENT_STATUSES = ["unknown", "opted_in", "opted_out"] as const;
export type ConsentStatus = (typeof CONSENT_STATUSES)[number];

export const CONSENT_LABELS: Record<ConsentStatus, string> = {
  unknown: "Not asked",
  opted_in: "Opted in",
  opted_out: "Opted out",
};

/** Suggestions for "how was consent given/withdrawn" (free text is also allowed). */
export const CONSENT_SOURCE_SUGGESTIONS = [
  "Website form",
  "Verbal (phone call)",
  "In person",
  "Written / signed form",
  "Email reply",
  "Asked to stop",
  "GHL import",
];

const TIME_ZONES = new Set(Intl.supportedValuesOf("timeZone"));
export function timeZoneOptions(): string[] {
  return [...TIME_ZONES].sort();
}

// ---------------------------------------------------------------------------
// Reusable field rules
// ---------------------------------------------------------------------------

/** Optional text: trims, turns blank into null, enforces a max length. */
const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} is too long (max ${max} characters)`)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional()
    .transform((v) => v ?? null);

const optionalEmail = z
  .string()
  .trim()
  .toLowerCase()
  .max(320)
  .transform((v) => (v === "" ? null : v))
  .pipe(z.email({ message: "Enter a valid email address" }).nullable())
  .nullable()
  .optional()
  .transform((v) => v ?? null);

const optionalPhone = z
  .unknown()
  .optional()
  .transform((v, ctx) => {
    const r = normalizePhone(v);
    if (!r.ok) {
      ctx.addIssue({ code: "custom", message: r.error });
      return z.NEVER;
    }
    return r.value;
  });

const optionalWebsite = z
  .string()
  .trim()
  .max(500)
  .transform((v) => (v === "" ? null : v))
  .transform((v) => (v && !/^https?:\/\//i.test(v) ? `https://${v}` : v))
  .pipe(z.url({ message: "Enter a valid website", protocol: /^https?$/ }).nullable())
  .nullable()
  .optional()
  .transform((v) => v ?? null);

/** "vip, owner , vip" -> ["vip", "owner"] */
const tagList = z
  .string()
  .optional()
  .transform((v) =>
    [...new Set((v ?? "").split(",").map((t) => t.trim()).filter(Boolean))],
  )
  .pipe(
    z
      .array(z.string().max(50, "Each tag must be 50 characters or fewer"))
      .max(50, "Too many tags (max 50)"),
  );

const optionalUuid = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .pipe(z.uuid().nullable())
  .nullable()
  .optional()
  .transform((v) => v ?? null);

const address = {
  address_line1: optionalText(200, "Address line 1"),
  address_line2: optionalText(200, "Address line 2"),
  city: optionalText(100, "City"),
  region: optionalText(100, "State / region"),
  postal_code: optionalText(20, "Postal code"),
  country: optionalText(100, "Country"),
};

// ---------------------------------------------------------------------------
// Company form
// ---------------------------------------------------------------------------
export const companySchema = z.object({
  name: z.string().trim().min(1, "Company name is required").max(200, "Name is too long"),
  website: optionalWebsite,
  email: optionalEmail,
  phone: optionalPhone,
  ...address,
  tags: tagList,
});
export type CompanyInput = z.infer<typeof companySchema>;

// ---------------------------------------------------------------------------
// Contact form
// ---------------------------------------------------------------------------
const consentStatus = z.enum(CONSENT_STATUSES).default("unknown");

export const contactSchema = z
  .object({
    first_name: optionalText(100, "First name"),
    last_name: optionalText(100, "Last name"),
    email: optionalEmail,
    phone: optionalPhone,
    types: z.array(z.enum(CONTACT_TYPES)).default([]).transform((t) => [...new Set(t)]),
    company_id: optionalUuid,
    ...address,
    time_zone: optionalText(64, "Time zone").refine((tz) => tz === null || TIME_ZONES.has(tz), {
      message: "Choose a time zone from the list",
    }),
    source: optionalText(100, "Source"),
    tags: tagList,
    email_consent: consentStatus,
    email_consent_source: optionalText(200, "How email consent was given"),
    sms_consent: consentStatus,
    sms_consent_source: optionalText(200, "How SMS consent was given"),
  })
  .superRefine((c, ctx) => {
    if (!c.first_name && !c.last_name && !c.email && !c.phone) {
      ctx.addIssue({
        code: "custom",
        path: ["first_name"],
        message: "Enter at least a name, email or phone",
      });
    }
    if (c.email_consent !== "unknown" && !c.email_consent_source) {
      ctx.addIssue({
        code: "custom",
        path: ["email_consent_source"],
        message: "Say how email consent was given or withdrawn",
      });
    }
    if (c.sms_consent !== "unknown" && !c.sms_consent_source) {
      ctx.addIssue({
        code: "custom",
        path: ["sms_consent_source"],
        message: "Say how SMS consent was given or withdrawn",
      });
    }
  });
export type ContactInput = z.infer<typeof contactSchema>;

// ---------------------------------------------------------------------------
// Deal form
// ---------------------------------------------------------------------------
export const STAGE_KINDS = ["open", "won", "lost"] as const;
export type StageKind = (typeof STAGE_KINDS)[number];
export const STAGE_KIND_LABELS: Record<StageKind, string> = { open: "Open", won: "Won", lost: "Lost" };

/** " (Won)" after a stage name in dropdowns — unless the name already says it. */
export function stageSuffix(stage: { name: string; kind: StageKind }): string {
  if (stage.kind === "open") return "";
  const label = STAGE_KIND_LABELS[stage.kind];
  return stage.name.toLowerCase() === label.toLowerCase() ? "" : ` (${label})`;
}

const optionalMoney = z
  .unknown()
  .optional()
  .transform((v, ctx) => {
    const r = parseMoney(v);
    if (!r.ok) {
      ctx.addIssue({ code: "custom", message: r.error });
      return z.NEVER;
    }
    return r.value;
  });

const optionalDate = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .pipe(z.iso.date({ message: "Enter a valid date" }).nullable())
  .nullable()
  .optional()
  .transform((v) => v ?? null);

export const dealSchema = z
  .object({
    title: z.string().trim().min(1, "Deal name is required").max(200, "Name is too long"),
    pipeline_id: z.uuid({ message: "Choose a pipeline" }),
    stage_id: z.uuid({ message: "Choose a stage" }),
    contact_id: optionalUuid,
    company_id: optionalUuid,
    value: optionalMoney,
    expected_close_date: optionalDate,
  })
  .superRefine((d, ctx) => {
    if (!d.contact_id && !d.company_id) {
      ctx.addIssue({ code: "custom", path: ["contact_id"], message: "Link this deal to a contact or a company" });
    }
  });
export type DealInput = z.infer<typeof dealSchema>;

export const NOTE_MAX_LENGTH = 10_000;
export const noteBodySchema = z
  .string({ message: "Write something first" })
  .trim()
  .min(1, "Write something first")
  .max(NOTE_MAX_LENGTH, `Notes can be up to ${NOTE_MAX_LENGTH.toLocaleString("en-US")} characters`);

export const pipelineNameSchema =z.string().trim().min(1, "Name is required").max(100, "Name is too long");

// ---------------------------------------------------------------------------
// Reading HTML form data
// ---------------------------------------------------------------------------
const MULTI_VALUE_FIELDS = new Set(["types"]);

/** Converts submitted form fields into a plain object for checking. Ignores files. */
export function formDataToObject(formData: FormData): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of new Set(formData.keys())) {
    if (key.startsWith("$")) continue; // Next.js internal fields
    const values = formData.getAll(key).filter((v): v is string => typeof v === "string");
    out[key] = MULTI_VALUE_FIELDS.has(key) ? values : values[0];
  }
  return out;
}

export type FieldErrors = Record<string, string>;

export function fieldErrors(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "_form");
    out[key] ??= issue.message;
  }
  return out;
}
