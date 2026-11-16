"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";

type State = { message?: string };

/** Archive / Restore button. Shows the database's answer if it refuses. */
export function ArchiveButton({
  archived,
  action,
}: {
  archived: boolean;
  action: (prev: State, formData: FormData) => Promise<State>;
}) {
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!archived && !confirm("Archive this record? It will be hidden from lists but can be restored by an admin.")) {
          e.preventDefault();
        }
      }}
      className="flex flex-col items-end gap-1"
    >
      <Button type="submit" variant={archived ? "outline" : "destructive"} disabled={pending}>
        {pending ? "Working…" : archived ? "Restore" : "Archive"}
      </Button>
      {state.message && <p className="text-xs text-destructive">{state.message}</p>}
    </form>
  );
}
