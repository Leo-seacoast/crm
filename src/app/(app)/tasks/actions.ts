"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { taskSchema } from "@/lib/tasks/tasks";
import { fieldErrors, formDataToObject, type FieldErrors } from "@/lib/records/schemas";
import { friendlyDbError } from "@/lib/records/db-errors";

export type TaskLink = { kind: "contact" | "company" | "deal"; id: string } | null;
export type TaskFormState = { ok?: boolean; message?: string; errors?: FieldErrors; values?: Record<string, unknown> };

const uuid = z.uuid();
const refresh = () => revalidatePath("/", "layout");

function linkColumns(link: TaskLink) {
  if (!link) return {};
  if (!uuid.safeParse(link.id).success) throw new Error("Invalid record");
  return link.kind === "contact" ? { contact_id: link.id } : link.kind === "company" ? { company_id: link.id } : { deal_id: link.id };
}

export async function addTask(link: TaskLink, _prev: TaskFormState, formData: FormData): Promise<TaskFormState> {
  await requireUser();
  const raw = formDataToObject(formData);
  const parsed = taskSchema.safeParse(raw);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values: raw };

  let columns;
  try {
    columns = linkColumns(link);
  } catch {
    return { message: "Record not found." };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("tasks").insert({ ...parsed.data, ...columns });
  if (error) return { message: friendlyDbError(error), values: raw };
  refresh();
  return { ok: true };
}

export async function updateTask(id: string, _prev: TaskFormState, formData: FormData): Promise<TaskFormState> {
  await requireUser();
  if (!uuid.safeParse(id).success) return { message: "Task not found." };
  const raw = formDataToObject(formData);
  const parsed = taskSchema.safeParse(raw);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values: raw };

  const supabase = await createClient();
  const { error } = await supabase.from("tasks").update(parsed.data).eq("id", id).select("id").single();
  if (error) return { message: friendlyDbError(error), values: raw };
  refresh();
  redirect(`/tasks/${id}`);
}

export async function setTaskDone(id: string, done: boolean): Promise<{ message?: string }> {
  await requireUser();
  if (!uuid.safeParse(id).success) return { message: "Task not found." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("tasks")
    .update({ status: done ? "done" : "open" })
    .eq("id", id)
    .select("id")
    .single();
  if (error) return { message: friendlyDbError(error) };
  refresh();
  return {};
}

export async function archiveTask(id: string, archive: boolean): Promise<{ message?: string }> {
  await requireUser();
  if (!uuid.safeParse(id).success) return { message: "Task not found." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("tasks")
    .update({ archived_at: archive ? new Date().toISOString() : null })
    .eq("id", id)
    .select("id")
    .single();
  if (error) {
    return { message: !archive && error.code === "PGRST116" ? "Only an admin can restore archived tasks." : friendlyDbError(error) };
  }
  refresh();
  if (archive) redirect("/tasks");
  return {};
}
