import { getSettings } from "@/lib/settings";
import { loadTasks } from "@/lib/tasks/load";
import { todayIn } from "@/lib/tasks/tasks";
import { addTask } from "@/app/(app)/tasks/actions";
import { TaskForm } from "./task-form";
import { TaskList } from "./task-list";

const COLUMN = { contact: "contact_id", company: "company_id", deal: "deal_id" } as const;

/** Tasks for one contact, company or deal: add a follow-up right where you are. */
export async function TasksSection({
  kind,
  recordId,
  readOnly,
}: {
  kind: "contact" | "company" | "deal";
  recordId: string;
  readOnly: boolean;
}) {
  const { timeZone } = await getSettings();
  const today = todayIn(timeZone);
  const [open, done] = await Promise.all([
    loadTasks({ recordColumn: COLUMN[kind], recordId, status: "open" }),
    loadTasks({ recordColumn: COLUMN[kind], recordId, status: "done" }, 10),
  ]);

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">Tasks ({open.length})</h2>
      {!readOnly && (
        <TaskForm action={addTask.bind(null, { kind, id: recordId })} initial={{ due_date: today }} submitLabel="Add task" compact />
      )}
      <TaskList tasks={open} today={today} showLink={false} emptyText="No open tasks." />
      {done.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-muted-foreground">Recently done ({done.length})</summary>
          <div className="mt-2">
            <TaskList tasks={done} today={today} showLink={false} emptyText="" />
          </div>
        </details>
      )}
    </section>
  );
}
