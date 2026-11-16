import type { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { CSV_BOM, csvFilename, csvHeader, csvLine } from "@/lib/csv";
import { EXPORTS } from "@/lib/export/definitions";
import { reportError } from "@/lib/monitoring";

const BATCH_SIZE = 1000;
const MAX_ROWS = 500_000; // hard stop, so a runaway export can't loop forever

/**
 * GET /export/contacts (or companies, deals, notes, activity)
 * Streams a CSV download. Admins only. Every export is recorded in the activity log.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  const def = Object.hasOwn(EXPORTS, kind) ? EXPORTS[kind] : undefined;
  if (!def) return new Response("Not found", { status: 404 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Please log in.", { status: 401 });

  const { data: me } = await supabase.from("profiles").select("role, archived_at").eq("id", user.id).single();
  if (!me || me.archived_at || me.role !== "admin") {
    return new Response("Only admins can export data.", { status: 403 });
  }

  // Names for "created by" / "owner" / note authors.
  const { data: profiles } = await supabase.from("profiles").select("id, full_name, email");
  const columns = def.columns({
    people: new Map((profiles ?? []).map((p) => [p.id, p.full_name ? `${p.full_name} <${p.email}>` : p.email])),
  });

  const searchParams = Object.fromEntries(request.nextUrl.searchParams);
  // Exports read rows generically, so use the untyped client here.
  const db = supabase as unknown as SupabaseClient;
  const encoder = new TextEncoder();

  // Record the export FIRST (who, what, how many rows, which filters).
  // If it can't be recorded, nothing is downloaded — no export goes unlogged.
  const counted = def.filter(db.from(def.table).select("id", { count: "exact", head: true }), searchParams);
  const { count, error: countError } = await counted.query;
  if (countError) return new Response("Could not prepare the export. Please try again.", { status: 500 });
  const { error: logError } = await supabase.rpc("log_export", {
    p_table: def.table,
    p_row_count: Math.min(count ?? 0, MAX_ROWS),
    p_filters: counted.used as never,
  });
  if (logError) {
    reportError(logError, { area: "csv-export", step: "log" });
    return new Response("The export could not be recorded, so it was stopped. Please try again.", { status: 500 });
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        controller.enqueue(encoder.encode(CSV_BOM + csvHeader(columns)));
        let lastId: string | number | null = null;
        let total = 0;

        // Read in batches, ordered by id, picking up after the last id each time.
        while (total < MAX_ROWS) {
          const base = db.from(def.table).select(def.select).order("id").limit(BATCH_SIZE);
          const { query } = def.filter(lastId === null ? base : base.gt("id", lastId), searchParams);
          const { data, error } = await query;
          if (error) throw new Error("Could not read data for export");
          const rows = (data ?? []) as Record<string, unknown>[];
          if (rows.length === 0) break;

          controller.enqueue(encoder.encode(rows.map((r) => csvLine(columns, r)).join("")));
          total += rows.length;
          lastId = rows[rows.length - 1].id as string | number;
          if (rows.length < BATCH_SIZE) break;
        }

        controller.close();
      } catch (e) {
        reportError(e, { area: "csv-export", table: def.table });
        controller.error(e);
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${csvFilename(def.fileName)}"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
