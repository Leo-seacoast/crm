"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { companySchema, fieldErrors, formDataToObject, type FieldErrors } from "@/lib/records/schemas";
import { friendlyDbError } from "@/lib/records/db-errors";
import { setArchived } from "@/lib/records/archive";

export type CompanyFormState = {
  errors?: FieldErrors;
  message?: string;
  values?: Record<string, unknown>;
};

/** Create (id = null) or update a company. */
export async function saveCompany(
  id: string | null,
  _prev: CompanyFormState,
  formData: FormData,
): Promise<CompanyFormState> {
  await requireUser();
  if (id !== null && !z.uuid().safeParse(id).success) return { message: "Company not found." };

  const raw = formDataToObject(formData);
  const parsed = companySchema.safeParse(raw);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values: raw };

  const supabase = await createClient();
  const result = id
    ? await supabase.from("companies").update(parsed.data).eq("id", id).select("id").single()
    : await supabase.from("companies").insert(parsed.data).select("id").single();

  if (result.error) return { message: friendlyDbError(result.error), values: raw };

  revalidatePath("/companies");
  redirect(`/companies/${result.data.id}`);
}

export async function archiveCompany(id: string, archive: boolean): Promise<{ message?: string }> {
  await requireUser();
  const r = await setArchived("companies", id, archive);
  if (!r.ok) return { message: r.message };
  revalidatePath("/companies");
  revalidatePath(`/companies/${id}`);
  return {};
}
