"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { setTaskDone } from "../actions";

export function DoneToggle({ id, done }: { id: string; done: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string>();
  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant={done ? "outline" : "default"}
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const r = await setTaskDone(id, !done);
            if (r.message) setMessage(r.message);
            else router.refresh();
          })
        }
      >
        {pending ? "Saving…" : done ? "Mark as not done" : "Mark as done"}
      </Button>
      {message && <p className="text-xs text-destructive">{message}</p>}
    </div>
  );
}
