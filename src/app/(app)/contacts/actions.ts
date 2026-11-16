"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { contactSchema, fieldErrors, formDataToObject, type FieldErrors } from "@/lib/records/schemas";
import { friendlyDbError, isDuplicate } from "@/lib/records/db-errors";
import { setArchived } from "@/lib/records/archive";
import { prepareConsentFields } from "@/lib/records/consent-fields";

export type ContactFormState = {
  errors?: FieldErrors;
  message?: string;
  /** When the email/phone already belongs to another contact: link to it. */
  existingContactId?: string;
  values?: Record<string, unknown>;
};

/** Create (id = null) or update a contact. */
export async function saveContact(
  id: string | null,
  _prev: ContactFormState,
  formData: FormData,
): Promise<ContactFormState> {
  await requireUser();
  if (id !== null && !z.uuid().safeParse(id).success) return { message: "Contact not found." };

  const raw = formDataToObject(formData);
  raw.types ??= [];

  // On edit, an empty consent choice means "leave consent as it is".
  const { toCheck, keepEmailConsent, keepSmsConsent } = prepareConsentFields(raw, id !== null);

  const parsed = contactSchema.safeParse(toCheck);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values: raw };

  const data: Partial<typeof parsed.data> = { ...parsed.data };
  if (keepEmailConsent) {
    delete data.email_consent;
    delete data.email_consent_source;
  }
  if (keepSmsConsent) {
    delete data.sms_consent;
    delete data.sms_consent_source;
  }

  const supabase = await createClient();
  const result = id
    ? await supabase.from("contacts").update(data).eq("id", id).select("id").single()
    : await supabase.from("contacts").insert(data as typeof parsed.data).select("id").single();

  if (result.error) {
    const state: ContactFormState = { message: friendlyDbError(result.error), values: raw };
    // Point to the existing contact so the person can open it instead.
    const dupField = isDuplicate(result.error, "contacts_email_unique")
      ? "email"
      : isDuplicate(result.error, "contacts_phone_unique")
        ? "phone"
        : null;
    if (dupField) {
      const value = parsed.data[dupField];
      if (value) {
        const { data: existing } = await supabase
          .from("contacts")
          .select("id")
          .is("archived_at", null)
          .eq(dupField, value)
          .neq("id", id ?? "00000000-0000-0000-0000-000000000000")
          .limit(1)
          .maybeSingle();
        state.existingContactId = existing?.id;
      }
    }
    return state;
  }

  revalidatePath("/contacts");
  redirect(`/contacts/${result.data.id}`);
}

export async function archiveContact(id: string, archive: boolean): Promise<{ message?: string }> {
  await requireUser();
  const r = await setArchived("contacts", id, archive);
  if (!r.ok) return { message: r.message };
  revalidatePath("/contacts");
  revalidatePath(`/contacts/${id}`);
  return {};
}
