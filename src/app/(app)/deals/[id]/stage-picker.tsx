"use client";

import { useState, useTransition } from "react";
import { selectClass } from "@/components/form-field";
import { stageSuffix, type StageKind } from "@/lib/records/schemas";
import { moveDeal } from "../actions";

/** Quick stage change from the deal page (works without dragging, e.g. on a phone). */
export function StagePicker({
  dealId,
  stageId,
  stages,
}: {
  dealId: string;
  stageId: string;
  stages: { id: string; name: string; kind: StageKind }[];
}) {
  const [value, setValue] = useState(stageId);
  const [message, setMessage] = useState<string>();
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <label htmlFor="stage-picker" className="font-medium">
        Move to stage
      </label>
      <select
        id="stage-picker"
        value={value}
        disabled={pending}
        className={`${selectClass} max-w-60`}
        onChange={(e) => {
          const next = e.target.value;
          const previous = value;
          setValue(next);
          setMessage(undefined);
          startTransition(async () => {
            const r = await moveDeal(dealId, next);
            if (!r.ok) {
              setValue(previous);
              setMessage(r.message);
            }
          });
        }}
      >
        {stages.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
            {stageSuffix(s)}
          </option>
        ))}
      </select>
      {pending && <span className="text-muted-foreground">Saving…</span>}
      {message && <span className="text-destructive">{message}</span>}
    </div>
  );
}
