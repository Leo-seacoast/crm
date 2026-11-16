import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { loadPipelines } from "@/lib/records/pipelines";
import { STAGE_KIND_LABELS, STAGE_KINDS, type StageKind } from "@/lib/records/schemas";
import { ActionForm } from "@/components/action-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { selectClass } from "@/components/form-field";
import { cn } from "@/lib/utils";
import {
  addPipeline,
  addStage,
  moveStage,
  renamePipeline,
  setPipelineArchived,
  setStageArchived,
  updateStage,
} from "./actions";

export const metadata = { title: "Pipeline settings · CRM" };

export default async function PipelineSettingsPage() {
  const user = await requireUser();
  if (user.role !== "admin") notFound(); // members don't see this page at all

  const pipelines = await loadPipelines({ includeArchived: true });

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-8 p-8">
      <div>
        <h1 className="text-2xl font-semibold">Pipeline settings</h1>
        <p className="text-sm text-muted-foreground">
          Admins only. Stages marked <strong>Won</strong> or <strong>Lost</strong> close a deal when it&apos;s moved
          there. A stage or pipeline can only be archived once it has no active deals.
        </p>
      </div>

      {pipelines.map((p) => (
        <section key={p.id} className={cn("flex flex-col gap-4 rounded-lg border p-4", p.archived && "opacity-60")}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <ActionForm action={renamePipeline.bind(null, p.id)} className="flex flex-wrap items-center gap-2">
              <Input name="name" defaultValue={p.name} aria-label="Pipeline name" className="w-64 font-semibold" />
              <Button type="submit" variant="outline" size="sm">
                Rename
              </Button>
              {p.archived && <Badge variant="outline">Archived</Badge>}
            </ActionForm>
            <ActionForm action={setPipelineArchived.bind(null, p.id, !p.archived)} className="flex flex-col items-end gap-1">
              <Button type="submit" variant={p.archived ? "outline" : "ghost"} size="sm">
                {p.archived ? "Restore pipeline" : "Archive pipeline"}
              </Button>
            </ActionForm>
          </div>

          <ol className="flex flex-col gap-2">
            {p.stages.map((s, i) => (
              <li key={s.id} className={cn("flex flex-wrap items-center gap-2", s.archived && "opacity-60")}>
                <span className="w-6 text-right text-xs text-muted-foreground">{i + 1}.</span>
                <ActionForm action={updateStage.bind(null, s.id)} className="flex flex-wrap items-center gap-2">
                  <Input name="name" defaultValue={s.name} aria-label="Stage name" className="w-52" />
                  <KindSelect value={s.kind} />
                  <Button type="submit" variant="outline" size="sm">
                    Save
                  </Button>
                </ActionForm>
                {!s.archived && (
                  <>
                    <ActionForm action={moveStage.bind(null, s.id, -1)}>
                      <Button type="submit" variant="ghost" size="icon-sm" aria-label={`Move ${s.name} earlier`} disabled={i === 0}>
                        ↑
                      </Button>
                    </ActionForm>
                    <ActionForm action={moveStage.bind(null, s.id, 1)}>
                      <Button
                        type="submit"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Move ${s.name} later`}
                        disabled={i === p.stages.filter((x) => !x.archived).length - 1}
                      >
                        ↓
                      </Button>
                    </ActionForm>
                  </>
                )}
                <ActionForm action={setStageArchived.bind(null, s.id, !s.archived)} className="contents">
                  <Button type="submit" variant="ghost" size="sm">
                    {s.archived ? "Restore" : "Archive"}
                  </Button>
                </ActionForm>
              </li>
            ))}
          </ol>

          {!p.archived && (
            <ActionForm action={addStage.bind(null, p.id)} className="flex flex-wrap items-center gap-2 border-t pt-4">
              <Input name="name" placeholder="New stage name" aria-label="New stage name" className="w-52" required />
              <KindSelect value="open" />
              <Button type="submit" size="sm">
                Add stage
              </Button>
            </ActionForm>
          )}
        </section>
      ))}

      <ActionForm action={addPipeline} className="flex flex-wrap items-center gap-2">
        <Input name="name" placeholder="New pipeline name" aria-label="New pipeline name" className="w-64" required />
        <Button type="submit">Add pipeline</Button>
      </ActionForm>
    </main>
  );
}

function KindSelect({ value }: { value: StageKind }) {
  return (
    <select name="kind" defaultValue={value} aria-label="Stage type" className={cn(selectClass, "w-28")}>
      {STAGE_KINDS.map((k) => (
        <option key={k} value={k}>
          {STAGE_KIND_LABELS[k]}
        </option>
      ))}
    </select>
  );
}
