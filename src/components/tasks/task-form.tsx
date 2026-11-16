"use client";

import { useActionState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { TaskFormState } from "@/app/(app)/tasks/actions";

type Initial = { title?: string; details?: string | null; due_date?: string; due_time?: string | null };

/** Add or edit a task. In "add" mode it clears itself after saving. */
export function TaskForm({
  action,
  initial,
  submitLabel,
  compact,
}: {
  action: (prev: TaskFormState, formData: FormData) => Promise<TaskFormState>;
  initial: Initial;
  submitLabel: string;
  compact?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  const v = { ...initial, ...((state.values ?? {}) as Initial) };
  const e = state.errors ?? {};
  const time = (v.due_time ?? "").slice(0, 5);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-2" key={JSON.stringify(state.values ?? {})}>
      <div className="flex flex-wrap items-start gap-2">
        <div className="flex min-w-56 flex-1 flex-col gap-1">
          <Input name="title" aria-label="Task" placeholder="e.g. Call Margaret about her renewal" defaultValue={v.title ?? ""} maxLength={200} required aria-invalid={!!e.title} />
          {e.title && <p className="text-xs text-destructive">{e.title}</p>}
        </div>
        <div className="flex flex-col gap-1">
          <Input name="due_date" type="date" aria-label="Due date" defaultValue={v.due_date ?? ""} required className="w-40" aria-invalid={!!e.due_date} />
          {e.due_date && <p className="text-xs text-destructive">{e.due_date}</p>}
        </div>
        <div className="flex flex-col gap-1">
          <Input name="due_time" type="time" aria-label="Time (optional)" defaultValue={time} className="w-32" />
          {e.due_time && <p className="text-xs text-destructive">{e.due_time}</p>}
        </div>
        {compact && (
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : submitLabel}
          </Button>
        )}
      </div>
      {!compact && (
        <>
          <Textarea name="details" aria-label="Details (optional)" placeholder="Details (optional)" defaultValue={v.details ?? ""} rows={4} maxLength={2000} />
          {e.details && <p className="text-xs text-destructive">{e.details}</p>}
          <div>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : submitLabel}
            </Button>
          </div>
        </>
      )}
      {state.message && <p role="alert" className="text-xs text-destructive">{state.message}</p>}
    </form>
  );
}
