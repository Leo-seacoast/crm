import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/money";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

/** Deals linked to a contact or company, shown on its page. */
export async function RelatedDeals({
  by,
  id,
  allowAdd,
}: {
  by: "contact_id" | "company_id";
  id: string;
  allowAdd: boolean;
}) {
  const supabase = await createClient();
  const { data: deals } = await supabase
    .from("deals")
    .select("id, title, value, currency, stage:pipeline_stages(name, kind), pipeline:pipelines(name)")
    .eq(by, id)
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .limit(100);

  const addHref = `/deals/new?${by === "contact_id" ? "contact" : "company"}=${id}`;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Deals ({deals?.length ?? 0})</h2>
        {allowAdd && (
          <Button variant="outline" size="sm" asChild>
            <Link href={addHref}>Add deal</Link>
          </Button>
        )}
      </div>
      {deals?.length === 0 && <p className="text-sm text-muted-foreground">No deals yet.</p>}
      <ul className="flex flex-col divide-y divide-border text-sm">
        {deals?.map((d) => (
          <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
            <Link href={`/deals/${d.id}`} className="font-medium hover:underline">
              {d.title}
            </Link>
            <span className="flex items-center gap-2 text-muted-foreground">
              {formatMoney(d.value, d.currency)}
              <span className="text-xs">{d.pipeline?.name}</span>
              <Badge variant={d.stage?.kind === "won" ? "default" : d.stage?.kind === "lost" ? "destructive" : "secondary"}>
                {d.stage?.name}
              </Badge>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
