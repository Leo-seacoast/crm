"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/form-field";
import type { CompanyFormState } from "./actions";

export type CompanyFormValues = {
  name?: string | null;
  website?: string | null;
  email?: string | null;
  phone?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  region?: string | null;
  postal_code?: string | null;
  country?: string | null;
  tags?: string[] | string | null;
};

export function CompanyForm({
  action,
  initial,
  cancelHref,
}: {
  action: (prev: CompanyFormState, formData: FormData) => Promise<CompanyFormState>;
  initial: CompanyFormValues;
  cancelHref: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const v = { ...initial, ...(state.values ?? {}) } as Record<string, unknown>;
  const e = state.errors ?? {};
  const text = (k: string) => {
    const val = v[k];
    if (Array.isArray(val)) return val.join(", ");
    return typeof val === "string" ? val : "";
  };
  // Re-mount inputs after each submit so they show the latest values.
  const key = JSON.stringify(state.values ?? {});

  const field = (name: string, label: string, props: React.ComponentProps<"input"> = {}) => (
    <FormField label={label} htmlFor={name} error={e[name]}>
      <Input id={name} name={name} defaultValue={text(name)} aria-invalid={!!e[name]} {...props} />
    </FormField>
  );

  return (
    <form action={formAction} key={key} className="flex flex-col gap-6">
      {state.message && (
        <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          {state.message}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {field("name", "Company name *", { required: true, maxLength: 200 })}
        {field("website", "Website", { placeholder: "example.com" })}
        {field("email", "Email", { type: "email" })}
        {field("phone", "Phone", { type: "tel" })}
      </div>

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-2 text-sm font-medium">Address</legend>
        {field("address_line1", "Address line 1")}
        {field("address_line2", "Address line 2")}
        {field("city", "City")}
        {field("region", "State / region")}
        {field("postal_code", "Postal code")}
        {field("country", "Country")}
      </fieldset>

      <FormField label="Tags" htmlFor="tags" error={e.tags} hint="Separate with commas">
        <Input id="tags" name="tags" defaultValue={text("tags")} />
      </FormField>

      <div className="flex gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save company"}
        </Button>
        <Button variant="outline" asChild>
          <Link href={cancelHref}>Cancel</Link>
        </Button>
      </div>
    </form>
  );
}
