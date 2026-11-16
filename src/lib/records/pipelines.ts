import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { StageKind } from "./schemas";

export type StageOption = { id: string; name: string; kind: StageKind; archived: boolean };
export type PipelineOption = { id: string; name: string; archived: boolean; stages: StageOption[] };

/** Pipelines with their stages, in display order. Archived ones only if asked. */
export async function loadPipelines({ includeArchived = false } = {}): Promise<PipelineOption[]> {
  const supabase = await createClient();
  const [{ data: pipelines }, { data: stages }] = await Promise.all([
    supabase.from("pipelines").select("id, name, position, archived_at").order("position").order("name"),
    supabase
      .from("pipeline_stages")
      .select("id, pipeline_id, name, kind, position, archived_at")
      .order("position")
      .order("name"),
  ]);

  return (pipelines ?? [])
    .filter((p) => includeArchived || !p.archived_at)
    .map((p) => ({
      id: p.id,
      name: p.name,
      archived: !!p.archived_at,
      stages: (stages ?? [])
        .filter((s) => s.pipeline_id === p.id && (includeArchived || !s.archived_at))
        .map((s) => ({ id: s.id, name: s.name, kind: s.kind, archived: !!s.archived_at })),
    }));
}
