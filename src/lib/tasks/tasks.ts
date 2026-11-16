import { z } from "zod";

/** Checks the add/edit task form on the server. */
export const taskSchema = z.object({
  title: z.string().trim().min(1, "Give the task a title").max(200, "Title is too long"),
  details: z
    .string()
    .trim()
    .max(2000, "Details are too long (max 2,000 characters)")
    .optional()
    .transform((v) => (v ? v : null)),
  due_date: z.iso.date({ message: "Choose a due date" }),
  due_time: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : null))
    .pipe(z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(:00)?$/, "Enter a valid time").nullable()),
});
export type TaskInput = z.infer<typeof taskSchema>;

/** Today's date ("2026-11-16") in the business time zone — not the server's. */
export function todayIn(timeZone: string, now: Date = new Date()): string {
  // en-CA formats dates as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** "2026-11-16" + 1 -> "2026-11-17" (calendar days, no time-zone surprises). */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return t.toISOString().slice(0, 10);
}

export type TaskBucket = "overdue" | "today" | "upcoming" | "done";

export function bucketFor(task: { status: string; due_date: string }, today: string): TaskBucket {
  if (task.status === "done") return "done";
  if (task.due_date < today) return "overdue";
  if (task.due_date === today) return "today";
  return "upcoming";
}

/** "Today", "Tomorrow", "Yesterday", "Mon, Nov 18" or "Nov 18, 2027", plus the time if set. */
export function formatDue(dueDate: string, dueTime: string | null, today: string): string {
  let day: string;
  if (dueDate === today) day = "Today";
  else if (dueDate === addDays(today, 1)) day = "Tomorrow";
  else if (dueDate === addDays(today, -1)) day = "Yesterday";
  else {
    const [y, m, d] = dueDate.split("-").map(Number);
    const date = new Date(Date.UTC(y, m - 1, d, 12));
    const sameYear = dueDate.slice(0, 4) === today.slice(0, 4);
    day = date.toLocaleDateString("en-US", {
      timeZone: "UTC",
      ...(sameYear ? { weekday: "short", month: "short", day: "numeric" } : { month: "short", day: "numeric", year: "numeric" }),
    });
  }
  if (!dueTime) return day;
  const [h, min] = dueTime.split(":").map(Number);
  const time = `${h % 12 || 12}:${String(min).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
  return `${day}, ${time}`;
}
