import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/session";
import { addNote, type NoteTarget } from "@/app/(app)/notes/actions";
import { NoteComposer } from "./note-composer";
import { NoteItem, type NoteView } from "./note-item";

const COLUMN = { contact: "contact_id", company: "company_id", deal: "deal_id" } as const;

/**
 * Notes for a contact, company or deal: a box to write one, then the notes,
 * pinned first, newest first. A contact's page also shows notes from its deals.
 */
export async function NotesSection({
  kind,
  recordId,
  readOnly,
}: {
  kind: NoteTarget;
  recordId: string;
  /** e.g. the record is archived */
  readOnly: boolean;
}) {
  const user = await requireUser();
  const supabase = await createClient();

  const select = "id, body, pinned, created_at, created_by, deal_id";

  // For a contact, also include notes on that contact's deals.
  let dealTitles = new Map<string, string>();
  if (kind === "contact") {
    const { data: deals } = await supabase.from("deals").select("id, title").eq("contact_id", recordId).limit(500);
    dealTitles = new Map((deals ?? []).map((d) => [d.id, d.title]));
  }

  let query = supabase.from("notes").select(select).is("archived_at", null);
  query =
    kind === "contact" && dealTitles.size > 0
      ? query.or(`contact_id.eq.${recordId},deal_id.in.(${[...dealTitles.keys()].join(",")})`)
      : query.eq(COLUMN[kind], recordId);

  const { data: rows, error } = await query
    .order("pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(200);

  const authorIds = [...new Set((rows ?? []).map((n) => n.created_by).filter((id): id is string => !!id))];
  const { data: authors } = authorIds.length
    ? await supabase.from("profiles").select("id, full_name, email").in("id", authorIds)
    : { data: [] };
  const authorName = new Map((authors ?? []).map((a) => [a.id, a.full_name ?? a.email]));

  const notes: NoteView[] = (rows ?? []).map((n) => ({
    id: n.id,
    body: n.body,
    pinned: n.pinned,
    createdAt: n.created_at,
    author: (n.created_by && authorName.get(n.created_by)) || (n.created_by ? "A removed team member" : "Imported / system"),
    isMine: n.created_by === user.id,
    fromDeal: kind === "contact" && n.deal_id ? { id: n.deal_id, title: dealTitles.get(n.deal_id) ?? "Deal" } : undefined,
  }));

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">Notes ({notes.length})</h2>
      {!readOnly && <NoteComposer action={addNote.bind(null, kind, recordId)} />}
      {error && <p className="text-sm text-destructive">Could not load notes. Please refresh.</p>}
      {notes.length === 0 && !error && <p className="text-sm text-muted-foreground">No notes yet.</p>}
      <ul className="flex flex-col gap-2">
        {notes.map((n) => (
          <NoteItem key={n.id} note={n} readOnly={readOnly} canArchive={n.isMine || user.role === "admin"} />
        ))}
      </ul>
    </section>
  );
}
