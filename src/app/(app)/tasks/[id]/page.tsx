import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/session";
import { getSettings } from "@/lib/settings";
import { bucketFor, formatDue, todayIn } from "@/lib/tasks/tasks";
import { TaskForm } from "@/components/tasks/task-form";
import { RecordHistory } from "@/components/record-history";
import { ArchiveButton } from "@/components/archive-button";
import { Badge } from "@/components/ui/badge";
import { formatPhone } from "@/lib/phone";
import { archiveTask, updateTask } from "../actions";
import { DoneToggle } from "./done-toggle";

export const metadata = { title: "Task · CRM" };

export default async function TaskPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const user = await requireUser();
  const supabase = await createClient();
  const { data: t } = await supabase
    .from("tasks")
    .select("*, contact:contacts(id, first_name, last_name, email, phone), company:companies(id, name), deal:deals(id, title)")
    .eq("id", id)
    .maybeSingle();
  if (!t) notFound();

  const { timeZone } = await getSettings();
  const today = todayIn(timeZone);
  const archived = !!t.archived_at;
  const canEdit = !archived || user.role === "admin";
  const bucket = bucketFor(t, today);
  const link = t.contact
    ? { href: `/contacts/${t.contact.id}`, name: [t.contact.first_name, t.contact.last_name].filter(Boolean).join(" ") || t.contact.email || formatPhone(t.contact.phone) }
    : t.company
      ? { href: `/companies/${t.company.id}`, name: t.company.name }
      : t.deal
        ? { href: `/deals/${t.deal.id}`, name: t.deal.title }
        : null;

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/tasks" className="text-sm text-muted-foreground hover:underline">
            ← Tasks
          </Link>
          <h1 className="mt-1 text-2xl font-semibold">
            {t.title}
            {archived && (
              <Badge variant="outline" className="ml-3 align-middle">
                Archived
              </Badge>
            )}
          </h1>
          <p className={bucket === "overdue" ? "text-sm font-medium text-destructive" : "text-sm text-muted-foreground"}>
            {t.status === "done" ? "Done" : bucket === "overdue" ? "Overdue — was due" : "Due"}{" "}
            {formatDue(t.due_date, t.due_time, today).toLowerCase()}
            {link && (
              <>
                {" · "}
                <Link href={link.href} className="hover:underline">
                  {link.name}
                </Link>
              </>
            )}
          </p>
        </div>
        <div className="flex items-start gap-3">
          {!archived && <DoneToggle id={id} done={t.status === "done"} />}
          {canEdit ? (
            <ArchiveButton archived={archived} action={archiveTask.bind(null, id, !archived)} />
          ) : (
            <p className="max-w-48 text-xs text-muted-foreground">Only an admin can restore this task.</p>
          )}
        </div>
      </div>

      {canEdit && !archived && (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">Edit</h2>
          <TaskForm
            action={updateTask.bind(null, id)}
            initial={{ title: t.title, details: t.details, due_date: t.due_date, due_time: t.due_time }}
            submitLabel="Save task"
          />
        </section>
      )}
      {archived && t.details && <p className="whitespace-pre-wrap text-sm">{t.details}</p>}

      <RecordHistory table="tasks" recordId={id} />
    </main>
  );
}
