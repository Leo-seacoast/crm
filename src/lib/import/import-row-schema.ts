import { z } from "zod";
import { MAX_EXTRA_VALUE } from "./ghl-contacts";

/**
 * The server re-checks every row the browser sends, because anything coming
 * from outside is untrusted. Rows that don't fit these rules are rejected.
 */
const text = (max: number) => z.string().max(max).nullable();
const PHONE = /^\+[1-9][0-9]{6,14}$/;

export const importContactRowSchema = z
  .object({
    row: z.number().int().min(1).max(10_000_000),
    action: z.enum(["create", "update"]),
    target_id: z.uuid().optional(),
    ghl_id: z.string().min(1).max(100).nullable(),
    first_name: text(100),
    last_name: text(100),
    email: z.string().max(320).regex(/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/).nullable(),
    phone: z.string().regex(PHONE).nullable(),
    company_id: z.uuid().nullable(),
    types: z.array(z.enum(["lead", "client", "owner", "guest", "vendor", "partner"])).max(6),
    tags: z.array(z.string().max(50)).max(50),
    created_at: z.iso.datetime().nullable(),
    address_line1: text(200),
    address_line2: text(200),
    city: text(100),
    region: text(100),
    postal_code: text(20),
    country: text(100),
    time_zone: text(64),
    source: text(100),
    // An import can record an opt-OUT, never an opt-in.
    email_consent: z.enum(["unknown", "opted_out"]),
    sms_consent: z.enum(["unknown", "opted_out"]),
    extra_fields: z
      .record(z.string().max(100), z.string().max(MAX_EXTRA_VALUE))
      .refine((o) => JSON.stringify(o).length <= 19000, "Too much extra data"),
  })
  .strict()
  .refine((r) => r.action === "create" || !!r.target_id, "Updates need a target contact")
  .refine((r) => r.first_name || r.last_name || r.email || r.phone, "No name, email or phone");

export type ImportContactRow = z.infer<typeof importContactRowSchema>;

// Small enough that each batch finishes well within the database's ~8-second limit.
export const MAX_ROWS_PER_BATCH = 200;
export const importBatchSchema = z.array(importContactRowSchema).min(1).max(MAX_ROWS_PER_BATCH);
