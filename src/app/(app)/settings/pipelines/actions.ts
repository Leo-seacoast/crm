"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { pipelineNameSchema, STAGE_KINDS } from "@/lib/records/schemas";
import { friendlyDbError } from "@/lib/records/db-errors";
import type { ActionResult } from "@/components/action-form";

// Every action here is admin-only. The database enforces this too (row-level security).
async function requireAdmin(): Promise<ActionResult | null> {
  const user = await requireUser();
  return user.role === "admin" ? null : { message: "Only admins can change pipelines." };
}

const id = z.uuid();
const done = (): ActionResult => {
  revalidatePath("/settings/pipelines");
  revalidatePath("/deals");
  return {};
};

export async function addPipeline(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const denied = await requireAdmin();
  if (denied) return denied;
  const name = pipelineNameSchema.safeParse(formData.get("name"));
  if (!name.success) return { message: name.error.issues[0].message };

  const supabase = await createClient();
  const { data: last } = await supabase.from("pipelines").select("position").order("position", { ascending: false }).limit(1).maybeSingle();
  const { data: pipeline, error } = await supabase
    .from("pipelines")
    .insert({ name: name.data, position: (last?.position ?? 0) + 1 })
    .select("id")
    .single();
  if (error) return { message: friendlyDbError(error) };

  // Every new pipeline starts with a sensible set of stages, which can be edited.
  await supabase.from("pipeline_stages").insert([
    { pipeline_id: pipeline.id, name: "New", kind: "open", position: 1 },
    { pipeline_id: pipeline.id, name: "In progress", kind: "open", position: 2 },
    { pipeline_id: pipeline.id, name: "Won", kind: "won", position: 3 },
    { pipeline_id: pipeline.id, name: "Lost", kind: "lost", position: 4 },
  ]);
  return done();
}

export async function renamePipeline(pipelineId: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const denied = await requireAdmin();
  if (denied) return denied;
  if (!id.safeParse(pipelineId).success) return { message: "Pipeline not found." };
  const name = pipelineNameSchema.safeParse(formData.get("name"));
  if (!name.success) return { message: name.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.from("pipelines").update({ name: name.data }).eq("id", pipelineId);
  return error ? { message: friendlyDbError(error) } : { ...done(), ok: true, message: "Saved." };
}

export async function setPipelineArchived(pipelineId: string, archive: boolean): Promise<ActionResult> {
  const denied = await requireAdmin();
  if (denied) return denied;
  if (!id.safeParse(pipelineId).success) return { message: "Pipeline not found." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("pipelines")
    .update({ archived_at: archive ? new Date().toISOString() : null })
    .eq("id", pipelineId);
  return error ? { message: friendlyDbError(error) } : done();
}

const stageFields = z.object({
  name: pipelineNameSchema,
  kind: z.enum(STAGE_KINDS, { message: "Choose open, won or lost" }),
});

export async function addStage(pipelineId: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const denied = await requireAdmin();
  if (denied) return denied;
  if (!id.safeParse(pipelineId).success) return { message: "Pipeline not found." };
  const parsed = stageFields.safeParse({ name: formData.get("name"), kind: formData.get("kind") });
  if (!parsed.success) return { message: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data: last } = await supabase
    .from("pipeline_stages")
    .select("position")
    .eq("pipeline_id", pipelineId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { error } = await supabase
    .from("pipeline_stages")
    .insert({ pipeline_id: pipelineId, ...parsed.data, position: (last?.position ?? 0) + 1 });
  return error ? { message: friendlyDbError(error) } : done();
}

export async function updateStage(stageId: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const denied = await requireAdmin();
  if (denied) return denied;
  if (!id.safeParse(stageId).success) return { message: "Stage not found." };
  const parsed = stageFields.safeParse({ name: formData.get("name"), kind: formData.get("kind") });
  if (!parsed.success) return { message: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.from("pipeline_stages").update(parsed.data).eq("id", stageId);
  return error ? { message: friendlyDbError(error) } : { ...done(), ok: true, message: "Saved." };
}

export async function setStageArchived(stageId: string, archive: boolean): Promise<ActionResult> {
  const denied = await requireAdmin();
  if (denied) return denied;
  if (!id.safeParse(stageId).success) return { message: "Stage not found." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("pipeline_stages")
    .update({ archived_at: archive ? new Date().toISOString() : null })
    .eq("id", stageId);
  return error ? { message: friendlyDbError(error) } : done();
}

/** Swap a stage with its neighbour (direction -1 = left/up, +1 = right/down). */
export async function moveStage(stageId: string, direction: -1 | 1): Promise<ActionResult> {
  const denied = await requireAdmin();
  if (denied) return denied;
  if (!id.safeParse(stageId).success) return { message: "Stage not found." };

  const supabase = await createClient();
  const { data: stage } = await supabase.from("pipeline_stages").select("pipeline_id").eq("id", stageId).single();
  if (!stage) return { message: "Stage not found." };
  const { data: siblings } = await supabase
    .from("pipeline_stages")
    .select("id, position")
    .eq("pipeline_id", stage.pipeline_id)
    .is("archived_at", null)
    .order("position")
    .order("name");
  const list = siblings ?? [];
  const i = list.findIndex((s) => s.id === stageId);
  const j = i + direction;
  if (i < 0 || j < 0 || j >= list.length) return {};

  // Renumber everything 1..n with the two swapped, so positions stay tidy.
  [list[i], list[j]] = [list[j], list[i]];
  for (const [index, s] of list.entries()) {
    if (s.position !== index + 1) {
      const { error } = await supabase.from("pipeline_stages").update({ position: index + 1 }).eq("id", s.id);
      if (error) return { message: friendlyDbError(error) };
    }
  }
  return done();
}
