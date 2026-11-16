"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { noteBodySchema } from "@/lib/records/schemas";
import { friendlyDbError } from "@/lib/records/db-errors";
import type { ActionResult } from "@/components/action-form";

export type NoteTarget = "contact" | "company" | "deal";
const COLUMN: Record<NoteTarget, "contact_id" | "company_id" | "deal_id"> = {
  contact: "contact_id",
  company: "company_id",
  deal: "deal_id",
};

const uuid = z.uuid();
const refresh = () => revalidatePath("/", "layout");

export async function addNote(
  kind: NoteTarget,
  recordId: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  await requireUser();
  if (!(kind in COLUMN) || !uuid.safeParse(recordId).success) return { message: "Record not found." };
  const body = noteBodySchema.safeParse(formData.get("body"));
  if (!body.success) return { message: body.error.issues[0].message };

  const supabase = await createClient();
  const link =
    kind === "contact" ? { contact_id: recordId } : kind === "company" ? { company_id: recordId } : { deal_id: recordId };
  const { error } = await supabase.from("notes").insert({ body: body.data, ...link });
  if (error) return { message: friendlyDbError(error) };
  refresh();
  return { ok: true };
}

export async function editNote(noteId: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireUser();
  if (!uuid.safeParse(noteId).success) return { message: "Note not found." };
  const body = noteBodySchema.safeParse(formData.get("body"));
  if (!body.success) return { message: body.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.from("notes").update({ body: body.data }).eq("id", noteId).select("id").single();
  if (error) return { message: friendlyDbError(error) };
  refresh();
  return { ok: true };
}

export async function setNotePinned(noteId: string, pinned: boolean): Promise<ActionResult> {
  await requireUser();
  if (!uuid.safeParse(noteId).success) return { message: "Note not found." };
  const supabase = await createClient();
  const { error } = await supabase.from("notes").update({ pinned }).eq("id", noteId).select("id").single();
  if (error) return { message: friendlyDbError(error) };
  refresh();
  return {};
}

export async function archiveNote(noteId: string): Promise<ActionResult> {
  await requireUser();
  if (!uuid.safeParse(noteId).success) return { message: "Note not found." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("notes")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", noteId)
    .select("id")
    .single();
  if (error) return { message: friendlyDbError(error) };
  refresh();
  return {};
}
