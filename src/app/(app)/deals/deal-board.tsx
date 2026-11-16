"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { formatMoney } from "@/lib/money";
import type { StageKind } from "@/lib/records/schemas";
import { moveDeal } from "./actions";

export type BoardDeal = {
  id: string;
  title: string;
  stage_id: string;
  value: number | null;
  currency: string;
  expected_close_date: string | null;
  who: string | null;
};
export type BoardStage = { id: string; name: string; kind: StageKind };

export function DealBoard({ stages, initialDeals }: { stages: BoardStage[]; initialDeals: BoardDeal[] }) {
  const [deals, setDeals] = useState(initialDeals);
  const [error, setError] = useState<string>();
  const [, startTransition] = useTransition();

  // Small movement needed before a drag starts, so normal clicks still open the deal.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  );

  function onDragEnd(event: DragEndEvent) {
    const dealId = String(event.active.id);
    const stageId = event.over ? String(event.over.id) : null;
    const deal = deals.find((d) => d.id === dealId);
    if (!deal || !stageId || deal.stage_id === stageId) return;

    const before = deals;
    // Move the card straight away; put it back if the server says no.
    setDeals((ds) => ds.map((d) => (d.id === dealId ? { ...d, stage_id: stageId } : d)));
    setError(undefined);
    startTransition(async () => {
      const r = await moveDeal(dealId, stageId);
      if (!r.ok) {
        setDeals(before);
        setError(r.message ?? "Could not move the deal.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      )}
      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {stages.map((stage) => (
            <Column key={stage.id} stage={stage} deals={deals.filter((d) => d.stage_id === stage.id)} />
          ))}
        </div>
      </DndContext>
    </div>
  );
}

function Column({ stage, deals }: { stage: BoardStage; deals: BoardDeal[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });
  const total = deals.reduce((sum, d) => sum + (d.value ?? 0), 0);
  const accent =
    stage.kind === "won" ? "border-t-green-600" : stage.kind === "lost" ? "border-t-destructive" : "border-t-border";

  return (
    <section
      ref={setNodeRef}
      aria-label={`${stage.name} stage`}
      className={`flex w-72 shrink-0 flex-col gap-2 rounded-lg border border-t-4 ${accent} bg-muted/40 p-2 transition-colors ${
        isOver ? "bg-muted" : ""
      }`}
    >
      <header className="flex items-baseline justify-between px-1">
        <h2 className="text-sm font-semibold">{stage.name}</h2>
        <span className="text-xs text-muted-foreground">
          {deals.length} · {formatMoney(total) || "$0"}
        </span>
      </header>
      <ul className="flex min-h-24 flex-col gap-2">
        {deals.map((d) => (
          <Card key={d.id} deal={d} />
        ))}
      </ul>
    </section>
  );
}

function Card({ deal }: { deal: BoardDeal }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: deal.id });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;

  return (
    <li
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`cursor-grab touch-manipulation rounded-md border border-border bg-background p-3 text-sm shadow-xs active:cursor-grabbing ${
        isDragging ? "z-10 opacity-80 shadow-lg" : ""
      }`}
    >
      <Link href={`/deals/${deal.id}`} className="font-medium hover:underline" draggable={false}>
        {deal.title}
      </Link>
      {deal.who && <div className="text-xs text-muted-foreground">{deal.who}</div>}
      <div className="mt-1 flex justify-between text-xs text-muted-foreground">
        <span>{formatMoney(deal.value, deal.currency)}</span>
        {deal.expected_close_date && (
          <span>
            {new Date(`${deal.expected_close_date}T12:00:00`).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })}
          </span>
        )}
      </div>
    </li>
  );
}
