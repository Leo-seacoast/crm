import "server-only";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { friendlyDbError } from "./db-errors";

export type ArchivableTable = "contacts" | "companies";

/**
 * Archive (soft delete) or restore a record.
 * The database decides who may do it: anyone can archive, only admins can restore.
 */
export async function setArchived(
  table: ArchivableTable,
  id: string,
  archive: boolean,
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!z.uuid().safeParse(id).success) return { ok: false, message: "Record not found." };

  const supabase = await createClient();
  const { error } = await supabase
    .from(table)
    .update({ archived_at: archive ? new Date().toISOString() : null })
    .eq("id", id)
    .select("id")
    .single();

  if (error) {
    return {
      ok: false,
      message:
        !archive && error.code === "PGRST116"
          ? "Only an admin can restore archived records."
          : friendlyDbError(error),
    };
  }
  return { ok: true };
}
