"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField, selectClass } from "@/components/form-field";
import { RecordPicker } from "@/components/record-picker";
import { stageSuffix, type StageKind } from "@/lib/records/schemas";
import type { DealFormState } from "./actions";

type Pipeline = { id: string; name: string; stages: { id: string; name: string; kind: StageKind }[] };

export function DealForm({
  action,
  pipelines,
  initial,
  cancelHref,
}: {
  action: (prev: DealFormState, formData: FormData) => Promise<DealFormState>;
  pipelines: Pipeline[];
  initial: {
    title?: string;
    pipeline_id?: string;
    stage_id?: string;
    value?: string;
    expected_close_date?: string;
    contact?: { id: string; label: string } | null;
    company?: { id: string; label: string } | null;
  };
  cancelHref: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const e = state.errors ?? {};
  const v = (state.values ?? {}) as Record<string, string | undefined>;

  const [pipelineId, setPipelineId] = useState(v.pipeline_id ?? initial.pipeline_id ?? pipelines[0]?.id ?? "");
  const pipeline = pipelines.find((p) => p.id === pipelineId);
  const startStage = v.stage_id ?? initial.stage_id;
  const stageDefault = pipeline?.stages.some((s) => s.id === startStage) ? startStage : pipeline?.stages[0]?.id;

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {state.message && (
        <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          {state.message}
        </p>
      )}

      <FormField label="Deal name *" htmlFor="title" error={e.title}>
        <Input
          id="title"
          name="title"
          required
          maxLength={200}
          defaultValue={v.title ?? initial.title ?? ""}
          placeholder="e.g. 12 Ocean Ave — management agreement"
        />
      </FormField>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Pipeline" htmlFor="pipeline_id" error={e.pipeline_id}>
          <select
            id="pipeline_id"
            name="pipeline_id"
            value={pipelineId}
            onChange={(ev) => setPipelineId(ev.target.value)}
            className={selectClass}
          >
            {pipelines.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Stage" htmlFor="stage_id" error={e.stage_id}>
          {/* key: reset the choice when the pipeline changes */}
          <select key={pipelineId} id="stage_id" name="stage_id" defaultValue={stageDefault} className={selectClass}>
            {pipeline?.stages.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {stageSuffix(s)}
              </option>
            ))}
          </select>
        </FormField>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Contact" htmlFor="contact_id" error={e.contact_id} hint="Type at least 2 letters to search">
          <RecordPicker
            name="contact_id"
            kind="contact"
            initial={initial.contact ?? null}
            placeholder="Search contacts"
            invalid={!!e.contact_id}
          />
        </FormField>
        <FormField label="Company" htmlFor="company_id" error={e.company_id} hint="A contact, a company, or both">
          <RecordPicker name="company_id" kind="company" initial={initial.company ?? null} placeholder="Search companies" />
        </FormField>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Value (USD)" htmlFor="value" error={e.value}>
          <Input id="value" name="value" inputMode="decimal" defaultValue={v.value ?? initial.value ?? ""} placeholder="12,500" />
        </FormField>
        <FormField label="Expected close date" htmlFor="expected_close_date" error={e.expected_close_date}>
          <Input
            id="expected_close_date"
            name="expected_close_date"
            type="date"
            defaultValue={v.expected_close_date ?? initial.expected_close_date ?? ""}
          />
        </FormField>
      </div>

      <div className="flex gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save deal"}
        </Button>
        <Button variant="outline" asChild>
          <Link href={cancelHref}>Cancel</Link>
        </Button>
      </div>
    </form>
  );
}
