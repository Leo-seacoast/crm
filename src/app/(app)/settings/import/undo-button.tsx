"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { undoImportStep } from "./actions";

/**
 * "Undo this import" — asks first, then archives the import's records in steps
 * of 1,000 (large imports would be too slow in one go). If interrupted, clicking
 * again carries on where it stopped.
 */
export function UndoImportButton({ importId, created }: { importId: string; created: number }) {
  const router = useRouter();
  const [message, setMessage] = useState<string>();
  const [working, setWorking] = useState(false);

  async function run() {
    const ok = confirm(
      `Undo this import?\n\nThis archives the ${created.toLocaleString()} contacts it created, and any companies ` +
        `it created that nothing else uses. Nothing is deleted — archived records can be restored by an admin.`,
    );
    if (!ok) return;
    setWorking(true);
    setMessage(undefined);
    let total = 0;
    for (let step = 0; step < 1000; step++) {
      const r = await undoImportStep(importId);
      if (!r.ok) {
        setMessage(r.message);
        setWorking(false);
        return;
      }
      total += r.data.archived;
      setMessage(`Archived ${total.toLocaleString()}… ${r.data.remaining.toLocaleString()} to go`);
      if (r.data.done) {
        setMessage(`Undone: archived ${total.toLocaleString()} records.`);
        setWorking(false);
        router.refresh();
        return;
      }
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button type="button" variant="destructive" size="sm" disabled={working} onClick={run}>
        {working ? "Undoing…" : "Undo this import"}
      </Button>
      {message && (
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {message}
        </p>
      )}
    </div>
  );
}
