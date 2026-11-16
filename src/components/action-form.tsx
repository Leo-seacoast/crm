"use client";

import { useActionState } from "react";

export type ActionResult = { message?: string; ok?: boolean };

/** A small form that shows the server's answer (e.g. an error) right next to it. */
export function ActionForm({
  action,
  children,
  className,
}: {
  action: (prev: ActionResult, formData: FormData) => Promise<ActionResult>;
  children: React.ReactNode;
  className?: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className={className} aria-busy={pending}>
      <fieldset disabled={pending} className="contents">
        {children}
      </fieldset>
      {state.message && (
        <p role="alert" className={`basis-full text-xs ${state.ok ? "text-muted-foreground" : "text-destructive"}`}>
          {state.message}
        </p>
      )}
    </form>
  );
}
