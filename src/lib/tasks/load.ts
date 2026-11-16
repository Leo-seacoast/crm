import "server-only";
import { createClient } from "@/lib/supabase/server";
import { formatPhone } from "@/lib/phone";

export type TaskRow = {
  id: string;
  title: string;
  details: string | null;
  due_date: string;
  due_time: string | null;
  status: "open" | "done";
  completed_at: string | null;
  archived_at: string | null;
  owner: string | null;
  link: { kind: "contact" | "company" | "deal"; id: string; name: string } | null;
};

const SELECT =
  "id, title, details, due_date, due_time, status, completed_at, archived_at, owner_id, " +
  "contact:contacts(id, first_name, last_name, email, phone), company:companies(id, name), deal:deals(id, title)";

type Filter =
  | { view: "overdue" | "today" | "upcoming" | "done"; today: string }
  | { recordColumn: "contact_id" | "company_id" | "deal_id"; recordId: string; status: "open" | "done" }
  | { mine: string; today: string };

/** Loads tasks with the names of what they're linked to and who they're for. */
export async function loadTasks(filter: Filter, limit = 200): Promise<TaskRow[]> {
  const supabase = await createClient();
  let q = supabase.from("tasks").select(SELECT).is("archived_at", null);

  if ("view" in filter) {
    if (filter.view === "done") q = q.eq("status", "done").order("completed_at", { ascending: false });
    else {
      q = q.eq("status", "open");
      if (filter.view === "overdue") q = q.lt("due_date", filter.today);
      if (filter.view === "today") q = q.eq("due_date", filter.today);
      if (filter.view === "upcoming") q = q.gt("due_date", filter.today);
      q = q.order("due_date").order("due_time", { nullsFirst: true });
    }
  } else if ("recordColumn" in filter) {
    q = q.eq(filter.recordColumn, filter.recordId).eq("status", filter.status);
    q = filter.status === "open" ? q.order("due_date").order("due_time", { nullsFirst: true }) : q.order("completed_at", { ascending: false });
  } else {
    q = q.eq("owner_id", filter.mine).eq("status", "open").lte("due_date", filter.today).order("due_date").order("due_time", { nullsFirst: true });
  }

  const { data } = await q.limit(limit);
  const rows = (data ?? []) as unknown as Array<Record<string, unknown> & {
    owner_id: string | null;
    contact: { id: string; first_name: string | null; last_name: string | null; email: string | null; phone: string | null } | null;
    company: { id: string; name: string } | null;
    deal: { id: string; title: string } | null;
  }>;

  const ownerIds = [...new Set(rows.map((r) => r.owner_id).filter((x): x is string => !!x))];
  const { data: people } = ownerIds.length
    ? await supabase.from("profiles").select("id, full_name, email").in("id", ownerIds)
    : { data: [] };
  const names = new Map((people ?? []).map((p) => [p.id, p.full_name ?? p.email]));

  return rows.map((r) => ({
    id: r.id as string,
    title: r.title as string,
    details: r.details as string | null,
    due_date: r.due_date as string,
    due_time: r.due_time as string | null,
    status: r.status as "open" | "done",
    completed_at: r.completed_at as string | null,
    archived_at: r.archived_at as string | null,
    owner: r.owner_id ? (names.get(r.owner_id) ?? null) : null,
    link: r.contact
      ? {
          kind: "contact",
          id: r.contact.id,
          name: [r.contact.first_name, r.contact.last_name].filter(Boolean).join(" ") || r.contact.email || formatPhone(r.contact.phone),
        }
      : r.company
        ? { kind: "company", id: r.company.id, name: r.company.name }
        : r.deal
          ? { kind: "deal", id: r.deal.id, name: r.deal.title }
          : null,
  }));
}

/** How many open tasks are overdue / due today / upcoming. */
export async function countTasks(today: string) {
  const supabase = await createClient();
  const base = () => supabase.from("tasks").select("id", { count: "exact", head: true }).is("archived_at", null).eq("status", "open");
  const [overdue, dueToday, upcoming] = await Promise.all([
    base().lt("due_date", today),
    base().eq("due_date", today),
    base().gt("due_date", today),
  ]);
  return { overdue: overdue.count ?? 0, today: dueToday.count ?? 0, upcoming: upcoming.count ?? 0 };
}
