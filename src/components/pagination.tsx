import Link from "next/link";

/** "Previous / Next" links that keep the current search and filters. */
export function Pagination({
  page,
  pageSize,
  total,
  params,
  basePath,
}: {
  page: number;
  pageSize: number;
  total: number;
  params: Record<string, string | undefined>;
  basePath: string;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const href = (p: number) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v && k !== "page") sp.set(k, v);
    if (p > 1) sp.set("page", String(p));
    const s = sp.toString();
    return s ? `${basePath}?${s}` : basePath;
  };

  return (
    <div className="flex items-center justify-between text-sm text-muted-foreground">
      <span>
        {total} {total === 1 ? "record" : "records"}
      </span>
      {pages > 1 && (
        <div className="flex items-center gap-4">
          {page > 1 ? <Link href={href(page - 1)}>← Previous</Link> : <span className="opacity-40">← Previous</span>}
          <span>
            Page {page} of {pages}
          </span>
          {page < pages ? <Link href={href(page + 1)}>Next →</Link> : <span className="opacity-40">Next →</span>}
        </div>
      )}
    </div>
  );
}
