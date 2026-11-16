"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { dealSchema, fieldErrors, formDataToObject, type FieldErrors } from "@/lib/records/schemas";
import { friendlyDbError } from "@/lib/records/db-errors";
import { setArchived } from "@/lib/records/archive";

export type DealFormState = { errors?: FieldErrors; message?: string; values?: Record<string, unknown> };

export async function saveDeal(id: string | null, _prev: DealFormState, formData: FormData): Promise<DealFormState> {
  await requireUser();
  if (id !== null && !z.uuid().safeParse(id).success) return { message: "Deal not found." };

  const raw = formDataToObject(formData);
  const parsed = dealSchema.safeParse(raw);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values: raw };

  const supabase = await createClient();
  const result = id
    ? await supabase.from("deals").update(parsed.data).eq("id", id).select("id").single()
    : await supabase.from("deals").insert(parsed.data).select("id").single();

  if (result.error) {
    const message =
      result.error.code === "23503"
        ? "That stage doesn't belong to the chosen pipeline. Please pick the stage again."
        : friendlyDbError(result.error);
    return { message, values: raw };
  }

  revalidatePath("/deals");
  redirect(`/deals/${result.data.id}`);
}

/** Used by the board when a card is dragged to another column. */
export async function moveDeal(dealId: string, stageId: string): Promise<{ ok: boolean; message?: string }> {
  await requireUser();
  if (!z.uuid().safeParse(dealId).success || !z.uuid().safeParse(stageId).success) {
    return { ok: false, message: "Deal not found." };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("deals")
    .update({ stage_id: stageId })
    .eq("id", dealId)
    .select("id")
    .single();
  if (error) {
    return {
      ok: false,
      message: error.code === "23503" ? "That stage is in a different pipeline." : friendlyDbError(error),
    };
  }
  revalidatePath("/deals");
  revalidatePath(`/deals/${dealId}`);
  return { ok: true };
}

export async function archiveDeal(id: string, archive: boolean): Promise<{ message?: string }> {
  await requireUser();
  const r = await setArchived("deals", id, archive);
  if (!r.ok) return { message: r.message };
  revalidatePath("/deals");
  revalidatePath(`/deals/${id}`);
  return {};
}
