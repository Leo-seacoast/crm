"use client";

import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { bucketFor, formatDue } from "@/lib/tasks/tasks";
import type { TaskRow } from "@/lib/tasks/load";
import { setTaskDone } from "@/app/(app)/tasks/actions";

const LINK_PATH = { contact: "contacts", company: "companies", deal: "deals" } as const;

/** A list of tasks with a tick box to mark each one done (or not done). */
export function TaskList({
  tasks,
  today,
  showLink = true,
  emptyText,
}: {
  tasks: TaskRow[];
  today: string;
  showLink?: boolean;
  emptyText: string;
}) {
  if (tasks.length === 0) return <p className="text-sm text-muted-foreground">{emptyText}</p>;
  return (
    <ul className="flex flex-col divide-y divide-border rounded-lg border">
      {tasks.map((t) => (
        <TaskItem key={t.id} task={t} today={today} showLink={showLink} />
      ))}
    </ul>
  );
}

function TaskItem({ task, today, showLink }: { task: TaskRow; today: string; showLink: boolean }) {
  const [done, setDone] = useOptimistic(task.status === "done");
  const [message, setMessage] = useState<string>();
  const [, startTransition] = useTransition();
  const bucket = bucketFor({ status: done ? "done" : "open", due_date: task.due_date }, today);

  return (
    <li className="flex items-start gap-3 p-3 text-sm">
      <input
        type="checkbox"
        className="mt-1 size-4"
        checked={done}
        aria-label={done ? `Mark "${task.title}" as not done` : `Mark "${task.title}" as done`}
        onChange={(e) => {
          const next = e.target.checked;
          setMessage(undefined);
          startTransition(async () => {
            setDone(next);
            const r = await setTaskDone(task.id, next);
            if (r.message) setMessage(r.message);
          });
        }}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <Link href={`/tasks/${task.id}`} className={cn("font-medium hover:underline", done && "text-muted-foreground line-through")}>
          {task.title}
        </Link>
        <div className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
          <span className={cn(bucket === "overdue" && "font-medium text-destructive", bucket === "today" && "font-medium text-foreground")}>
            {bucket === "overdue" ? "Overdue · " : ""}
            {formatDue(task.due_date, task.due_time, today)}
          </span>
          {showLink && task.link && (
            <Link href={`/${LINK_PATH[task.link.kind]}/${task.link.id}`} className="hover:underline">
              {task.link.name}
            </Link>
          )}
          {task.owner && <span>For {task.owner}</span>}
        </div>
        {message && <p className="text-xs text-destructive">{message}</p>}
      </div>
    </li>
  );
}
