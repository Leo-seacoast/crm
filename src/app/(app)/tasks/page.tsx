import Link from "next/link";
import { getSettings } from "@/lib/settings";
import { countTasks, loadTasks } from "@/lib/tasks/load";
import { todayIn } from "@/lib/tasks/tasks";
import { requireUser } from "@/lib/auth/session";
import { ExportButton } from "@/components/export-button";
import { TaskForm } from "@/components/tasks/task-form";
import { TaskList } from "@/components/tasks/task-list";
import { cn } from "@/lib/utils";
import { addTask } from "./actions";

export const metadata = { title: "Tasks · CRM" };

const VIEWS = ["overdue", "today", "upcoming", "done"] as const;
type View = (typeof VIEWS)[number];
const LABELS: Record<View, string> = { overdue: "Overdue", today: "Today", upcoming: "Upcoming", done: "Done" };
const EMPTY: Record<View, string> = {
  overdue: "Nothing overdue. Nice.",
  today: "Nothing due today.",
  upcoming: "Nothing coming up.",
  done: "No completed tasks yet.",
};

export default async function TasksPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { view: requested } = await searchParams;
  const user = await requireUser();
  const { timeZone } = await getSettings();
  const today = todayIn(timeZone);
  const counts = await countTasks(today);

  // Default: Overdue if anything is overdue, otherwise Today.
  const view: View = VIEWS.includes(requested as View) ? (requested as View) : counts.overdue > 0 ? "overdue" : "today";
  const tasks = await loadTasks({ view, today });
  const countFor = (v: View) => (v === "done" ? null : counts[v]);

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
       <div>
        <h1 className="text-2xl font-semibold">Tasks</h1>
        <p className="text-sm text-muted-foreground">
          Today is{" "}
          {new Date(`${today}T12:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", weekday: "long", month: "long", day: "numeric" })}{" "}
          ({timeZone.replace(/_/g, " ")} time).
        </p>
       </div>
        {user.role === "admin" && <ExportButton href="/export/tasks" />}
      </div>

      <section className="rounded-lg border p-4">
        <h2 className="mb-2 text-sm font-medium">Add a task</h2>
        <TaskForm action={addTask.bind(null, null)} initial={{ due_date: today }} submitLabel="Add task" compact />
        <p className="mt-2 text-xs text-muted-foreground">
          Tip: add tasks from a contact, company or deal page to link them to that record.
        </p>
      </section>

      <nav aria-label="Task views" className="flex flex-wrap gap-2 border-b">
        {VIEWS.map((v) => {
          const n = countFor(v);
          return (
            <Link
              key={v}
              href={`/tasks?view=${v}`}
              aria-current={v === view ? "page" : undefined}
              className={cn(
                "-mb-px border-b-2 px-3 py-2 text-sm",
                v === view ? "border-foreground font-medium" : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {LABELS[v]}
              {n !== null && (
                <span className={cn("ml-1.5 rounded-full px-1.5 text-xs", v === "overdue" && n > 0 ? "bg-destructive/10 text-destructive" : "bg-muted")}>
                  {n}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <TaskList tasks={tasks} today={today} emptyText={EMPTY[view]} />
    </main>
  );
}
