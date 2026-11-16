"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { importBatchSchema } from "@/lib/import/import-row-schema";
import { reportError } from "@/lib/monitoring";

/**
 * Server side of the import. Every action re-checks that the person is an admin
 * (the database functions check again), and every row is validated again here.
 */
async function adminClient() {
  const user = await requireUser();
  if (user.role !== "admin") throw new Error("Only admins can import data.");
  return createClient();
}

type Result<T> = { ok: true; data: T } | { ok: false; message: string };
const fail = (message: string): { ok: false; message: string } => ({ ok: false, message });

export async function startContactImport(
  fileName: string,
  totalRows: number,
  settings: Record<string, unknown>,
): Promise<Result<string>> {
  try {
    const supabase = await adminClient();
    const { data, error } = await supabase.rpc("start_import", {
      p_kind: "contacts",
      p_file_name: z.string().max(255).catch("import.csv").parse(fileName),
      p_total_rows: z.number().int().min(0).max(1_000_000).catch(0).parse(totalRows),
      p_settings: JSON.parse(JSON.stringify(settings ?? {})),
    });
    if (error) return fail("Could not start the import.");
    return { ok: true, data: data as string };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Could not start the import.");
  }
}

// At most 900 values per lookup, so the answer stays under the database's 1,000-record cap.
const lookupSchema = z
  .object({
    emails: z.array(z.string().max(320)).max(900),
    phones: z.array(z.string().max(20)).max(900),
    ghlIds: z.array(z.string().max(100)).max(900),
  })
  .refine((k) => k.emails.length + k.phones.length + k.ghlIds.length <= 900, "Too many values in one lookup");

/** Existing CRM contacts with any of these GHL IDs, emails or phones (for the preview). */
export async function findExistingContacts(
  emails: string[],
  phones: string[],
  ghlIds: string[],
): Promise<Result<{ id: string; email: string | null; phone: string | null; ghl_id: string | null; name: string }[]>> {
  try {
    const supabase = await adminClient();
    const input = lookupSchema.parse({ emails, phones, ghlIds });
    const { data, error } = await supabase.rpc("find_existing_contacts", {
      p_emails: input.emails.map((e) => e.toLowerCase()),
      p_phones: input.phones,
      p_ghl_ids: input.ghlIds,
    });
    if (error) return fail("Could not check for existing contacts.");
    return {
      ok: true,
      data: (data ?? []).map((c) => ({
        id: c.id,
        email: c.email,
        phone: c.phone,
        ghl_id: c.ghl_id,
        name: [c.first_name, c.last_name].filter(Boolean).join(" ") || c.email || c.phone || "a contact",
      })),
    };
  } catch {
    return fail("Could not check for existing contacts.");
  }
}

/** Creates (or finds) companies for the business names; returns name -> id. */
export async function importCompanies(importId: string, names: string[]): Promise<Result<Record<string, string>>> {
  try {
    const supabase = await adminClient();
    const id = z.uuid().parse(importId);
    const list = z.array(z.string().max(200)).max(2000).parse(names);
    const { data, error } = await supabase.rpc("import_companies", { p_import_id: id, p_names: list });
    if (error) return fail(error.message.includes("not open") ? error.message : "Could not create companies.");
    const map: Record<string, string> = {};
    for (const row of data ?? []) map[row.name.toLowerCase()] = row.id;
    return { ok: true, data: map };
  } catch {
    return fail("Could not create companies.");
  }
}

export type BatchResult = {
  created: number;
  updated: number;
  skipped: number;
  errors: { row: number; message: string }[];
};

export async function importContactBatch(importId: string, rows: unknown): Promise<Result<BatchResult>> {
  try {
    const supabase = await adminClient();
    const id = z.uuid().parse(importId);
    const parsed = importBatchSchema.safeParse(rows);
    if (!parsed.success) {
      return fail(`Some rows didn't pass the server's checks (${parsed.error.issues[0]?.message ?? "invalid data"}).`);
    }
    const { data, error } = await supabase.rpc("import_contacts_batch", {
      p_import_id: id,
      p_rows: parsed.data as never,
    });
    if (error) {
      reportError(error, { area: "import", step: "contacts-batch" });
      if (error.message.includes("not open")) return fail(error.message);
      if (/timeout|canceling statement/i.test(error.message)) {
        return fail("The database took too long to save this batch, so nothing in it was saved.");
      }
      return fail("This batch could not be saved.");
    }
    return { ok: true, data: data as unknown as BatchResult };
  } catch (e) {
    reportError(e, { area: "import", step: "contacts-batch" });
    return fail("This batch could not be saved.");
  }
}

export async function finishImport(importId: string, skippedInPreview: number): Promise<Result<null>> {
  try {
    const supabase = await adminClient();
    const { error } = await supabase.rpc("finish_import", {
      p_import_id: z.uuid().parse(importId),
      p_skipped_in_preview: z.number().int().min(0).catch(0).parse(skippedInPreview),
    });
    if (error) return fail("Could not finish the import.");
    revalidatePath("/", "layout");
    return { ok: true, data: null };
  } catch {
    return fail("Could not finish the import.");
  }
}

/** One step of undoing an import (up to 1,000 records). The page calls this until done. */
export async function undoImportStep(
  importId: string,
): Promise<Result<{ archived: number; remaining: number; done: boolean }>> {
  try {
    const supabase = await adminClient();
    const { data, error } = await supabase.rpc("undo_import_step", {
      p_import_id: z.uuid().parse(importId),
      p_limit: 1000,
    });
    if (error) {
      reportError(error, { area: "import", step: "undo" });
      return fail(error.message.includes("already") ? error.message : "Could not undo this import. Click Undo again to carry on.");
    }
    const r = data as { archived: number; remaining: number; done: boolean };
    if (r.done) revalidatePath("/", "layout");
    return { ok: true, data: r };
  } catch {
    return fail("Could not undo this import. Click Undo again to carry on.");
  }
}
