import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { getSettings } from "@/lib/settings";
import { loadTasks } from "@/lib/tasks/load";
import { todayIn } from "@/lib/tasks/tasks";
import { TaskList } from "@/components/tasks/task-list";
import { Button } from "@/components/ui/button";

export default async function Home() {
  const user = await requireUser();
  const { timeZone } = await getSettings();
  const today = todayIn(timeZone);
  const myTasks = await loadTasks({ mine: user.id, today }, 50);
  const overdue = myTasks.filter((t) => t.due_date < today).length;

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 p-8">
      <div>
        <h1 className="text-3xl font-semibold">Welcome{user.fullName ? `, ${user.fullName}` : ""}</h1>
        <p className="text-muted-foreground">
          {myTasks.length === 0
            ? "You have nothing due today."
            : `You have ${myTasks.length} ${myTasks.length === 1 ? "task" : "tasks"} due today or earlier${overdue ? ` (${overdue} overdue)` : ""}.`}
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Your tasks for today</h2>
          <Button variant="outline" size="sm" asChild>
            <Link href="/tasks">All tasks</Link>
          </Button>
        </div>
        <TaskList tasks={myTasks} today={today} emptyText="Nothing due. Add follow-ups from any contact, company or deal page." />
      </section>
    </main>
  );
}
