"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField, selectClass } from "@/components/form-field";
import {
  CONSENT_LABELS,
  CONSENT_SOURCE_SUGGESTIONS,
  CONTACT_TYPE_LABELS,
  CONTACT_TYPES,
  type ConsentStatus,
} from "@/lib/records/schemas";
import type { ContactFormState } from "./actions";

export type ContactFormValues = Record<string, unknown> & {
  email_consent?: ConsentStatus;
  sms_consent?: ConsentStatus;
};

type Props = {
  action: (prev: ContactFormState, formData: FormData) => Promise<ContactFormState>;
  initial: ContactFormValues;
  /** Editing an existing contact (consent then works as "change to…"). */
  isEdit: boolean;
  companies: { id: string; name: string }[];
  timeZones: string[];
  cancelHref: string;
};

export function ContactForm({ action, initial, isEdit, companies, timeZones, cancelHref }: Props) {
  const [state, formAction, pending] = useActionState(action, {});
  const v: Record<string, unknown> = { ...initial, ...(state.values ?? {}) };
  const e = state.errors ?? {};
  const text = (k: string) => {
    const val = v[k];
    if (Array.isArray(val)) return val.join(", ");
    return typeof val === "string" ? val : "";
  };
  const types = new Set(Array.isArray(v.types) ? (v.types as string[]) : []);
  const key = JSON.stringify(state.values ?? {});

  const field = (name: string, label: string, props: React.ComponentProps<"input"> = {}) => (
    <FormField label={label} htmlFor={name} error={e[name]}>
      <Input id={name} name={name} defaultValue={text(name)} aria-invalid={!!e[name]} {...props} />
    </FormField>
  );

  return (
    <form action={formAction} key={key} className="flex flex-col gap-8">
      {state.message && (
        <div role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          {state.message}{" "}
          {state.existingContactId && (
            <Link href={`/contacts/${state.existingContactId}`} className="font-medium underline">
              Open the existing contact
            </Link>
          )}
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-2">
        {field("first_name", "First name", { autoComplete: "off" })}
        {field("last_name", "Last name", { autoComplete: "off" })}
        {field("email", "Email", { type: "email", autoComplete: "off" })}
        {field("phone", "Phone", { type: "tel", autoComplete: "off", placeholder: "(603) 555-0123" })}
      </section>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">Type (choose any that apply)</legend>
        <div className="flex flex-wrap gap-4">
          {CONTACT_TYPES.map((t) => (
            <label key={t} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="types" value={t} defaultChecked={types.has(t)} />
              {CONTACT_TYPE_LABELS[t]}
            </label>
          ))}
        </div>
        {e.types && <p className="text-xs text-destructive">{e.types}</p>}
      </fieldset>

      <section className="grid gap-4 sm:grid-cols-2">
        <FormField label="Company" htmlFor="company_id" error={e.company_id}>
          <select id="company_id" name="company_id" defaultValue={text("company_id")} className={selectClass}>
            <option value="">— None —</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </FormField>
        {field("source", "Source", { placeholder: "e.g. Referral, Website, GHL import" })}
        <FormField
          label="Time zone"
          htmlFor="time_zone"
          error={e.time_zone}
          hint="Used later so automated messages never go out overnight"
        >
          <select id="time_zone" name="time_zone" defaultValue={text("time_zone")} className={selectClass}>
            <option value="">— Unknown (use business time zone) —</option>
            {timeZones.map((tz) => (
              <option key={tz} value={tz}>
                {tz.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Tags" htmlFor="tags" error={e.tags} hint="Separate with commas">
          <Input id="tags" name="tags" defaultValue={text("tags")} />
        </FormField>
      </section>

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-2 text-sm font-medium">Address</legend>
        {field("address_line1", "Address line 1")}
        {field("address_line2", "Address line 2")}
        {field("city", "City")}
        {field("region", "State / region")}
        {field("postal_code", "Postal code")}
        {field("country", "Country")}
      </fieldset>

      <fieldset className="flex flex-col gap-4 rounded-lg border border-border p-4">
        <legend className="px-1 text-sm font-medium">Marketing consent</legend>
        <p className="text-xs text-muted-foreground">
          Record only what the contact actually agreed to. Once someone opts out, only they can opt back in.
        </p>
        <ConsentPicker
          channel="email"
          label="Email"
          current={(initial.email_consent ?? "unknown") as ConsentStatus}
          isEdit={isEdit}
          chosen={text("email_consent")}
          source={text("email_consent_source")}
          error={e.email_consent ?? e.email_consent_source}
        />
        <ConsentPicker
          channel="sms"
          label="SMS"
          current={(initial.sms_consent ?? "unknown") as ConsentStatus}
          isEdit={isEdit}
          chosen={text("sms_consent")}
          source={text("sms_consent_source")}
          error={e.sms_consent ?? e.sms_consent_source}
        />
        <datalist id="consent-sources">
          {CONSENT_SOURCE_SUGGESTIONS.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      </fieldset>

      <div className="flex gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save contact"}
        </Button>
        <Button variant="outline" asChild>
          <Link href={cancelHref}>Cancel</Link>
        </Button>
      </div>
    </form>
  );
}

/** Which consent changes are allowed from the current status. */
function allowedChanges(current: ConsentStatus): ConsentStatus[] {
  if (current === "opted_out") return []; // only the contact can opt back in
  if (current === "opted_in") return ["opted_out"];
  return ["opted_in", "opted_out"];
}

function ConsentPicker({
  channel,
  label,
  current,
  isEdit,
  chosen,
  source,
  error,
}: {
  channel: "email" | "sms";
  label: string;
  current: ConsentStatus;
  isEdit: boolean;
  chosen: string;
  source: string;
  error?: string;
}) {
  const name = `${channel}_consent`;
  const options = isEdit ? allowedChanges(current) : (["unknown", "opted_in", "opted_out"] as ConsentStatus[]);

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <FormField label={label} htmlFor={name}>
        {isEdit && options.length === 0 ? (
          <p className="text-sm">
            <strong>{CONSENT_LABELS[current]}</strong> — can&apos;t be changed here.
          </p>
        ) : (
          <select id={name} name={name} defaultValue={chosen} className={selectClass}>
            {isEdit && <option value="">No change (currently {CONSENT_LABELS[current].toLowerCase()})</option>}
            {options.map((s) => (
              <option key={s} value={s}>
                {isEdit ? `Change to: ${CONSENT_LABELS[s]}` : CONSENT_LABELS[s]}
              </option>
            ))}
          </select>
        )}
      </FormField>
      {options.length > 0 && (
        <FormField label="How was this given or withdrawn?" htmlFor={`${name}_source`} error={error}>
          <Input
            id={`${name}_source`}
            name={`${name}_source`}
            list="consent-sources"
            defaultValue={source}
            placeholder="e.g. Verbal (phone call)"
          />
        </FormField>
      )}
    </div>
  );
}
