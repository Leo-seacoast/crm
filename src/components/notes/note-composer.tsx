"use client";

import { useActionState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { NOTE_MAX_LENGTH } from "@/lib/records/schemas";
import type { ActionResult } from "@/components/action-form";

/** The "write a note" box. Clears itself after a successful save. */
export function NoteComposer({
  action,
}: {
  action: (prev: ActionResult, formData: FormData) => Promise<ActionResult>;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-2">
      <label htmlFor="new-note" className="sr-only">
        New note
      </label>
      <Textarea
        id="new-note"
        name="body"
        rows={3}
        maxLength={NOTE_MAX_LENGTH}
        required
        placeholder="Write a note…"
        disabled={pending}
      />
      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Saving…" : "Add note"}
        </Button>
        {state.message && !state.ok && <p className="text-xs text-destructive">{state.message}</p>}
      </div>
    </form>
  );
}
