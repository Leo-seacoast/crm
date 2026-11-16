"use client";

import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { NOTE_MAX_LENGTH } from "@/lib/records/schemas";
import { archiveNote, editNote, setNotePinned } from "@/app/(app)/notes/actions";

export type NoteView = {
  id: string;
  body: string;
  pinned: boolean;
  createdAt: string;
  author: string;
  isMine: boolean;
  /** Set when the note belongs to a deal but is shown on a contact page. */
  fromDeal?: { id: string; title: string };
};

export function NoteItem({ note, canArchive, readOnly }: { note: NoteView; canArchive: boolean; readOnly: boolean }) {
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState<string>();
  const [pending, startTransition] = useTransition();
  const [editState, editAction, saving] = useActionState(
    async (prev: { message?: string; ok?: boolean }, fd: FormData) => {
      const r = await editNote(note.id, prev, fd);
      if (r.ok) setEditing(false);
      return r;
    },
    {},
  );

  const run = (fn: () => Promise<{ message?: string }>) =>
    startTransition(async () => {
      const r = await fn();
      setMessage(r.message);
    });

  return (
    <li className={`flex flex-col gap-2 rounded-lg border p-3 text-sm ${note.pinned ? "border-amber-400 bg-amber-50/50 dark:bg-amber-950/20" : ""}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          <strong className="text-foreground">{note.author}</strong> ·{" "}
          {new Date(note.createdAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
          {note.fromDeal && (
            <>
              {" "}
              · on deal{" "}
              <Link href={`/deals/${note.fromDeal.id}`} className="underline">
                {note.fromDeal.title}
              </Link>
            </>
          )}
        </span>
        <span className="flex items-center gap-1">
          {note.pinned && <Badge variant="outline">Pinned</Badge>}
          {!readOnly && (
            <>
              <Button variant="ghost" size="xs" disabled={pending} onClick={() => run(() => setNotePinned(note.id, !note.pinned))}>
                {note.pinned ? "Unpin" : "Pin"}
              </Button>
              {note.isMine && !editing && (
                <Button variant="ghost" size="xs" onClick={() => setEditing(true)}>
                  Edit
                </Button>
              )}
              {canArchive && (
                <Button
                  variant="ghost"
                  size="xs"
                  disabled={pending}
                  onClick={() => {
                    if (confirm("Archive this note? An admin can restore it later.")) run(() => archiveNote(note.id));
                  }}
                >
                  Archive
                </Button>
              )}
            </>
          )}
        </span>
      </div>

      {editing ? (
        <form action={editAction} className="flex flex-col gap-2">
          <Textarea name="body" defaultValue={note.body} rows={4} maxLength={NOTE_MAX_LENGTH} required aria-label="Edit note" />
          <div className="flex items-center gap-2">
            <Button type="submit" size="sm" disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            {editState.message && !editState.ok && <span className="text-xs text-destructive">{editState.message}</span>}
          </div>
        </form>
      ) : (
        // Plain text only: React shows it exactly as typed (never as code), keeping line breaks.
        <p className="whitespace-pre-wrap break-words">{note.body}</p>
      )}
      {message && <p className="text-xs text-destructive">{message}</p>}
    </li>
  );
}
