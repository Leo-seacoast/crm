/** Shows fields imported from GHL that don't have their own place in the CRM (yet). */
export function ExtraFields({ fields }: { fields: unknown }) {
  if (!fields || typeof fields !== "object" || Array.isArray(fields)) return null;
  // Alphabetical, so the same field is always in the same place.
  const entries = Object.entries(fields as Record<string, unknown>)
    .filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== "")
    .sort(([a], [b]) => a.localeCompare(b));
  if (entries.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">Extra fields</h2>
      <p className="text-xs text-muted-foreground">Imported from GHL. Shown exactly as they were there.</p>
      <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
        {entries.map(([key, value]) => (
          <div key={key}>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{key}</dt>
            {/* Plain text only — imported values are never treated as code or links. */}
            <dd className="mt-1 whitespace-pre-wrap break-words">{String(value)}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
