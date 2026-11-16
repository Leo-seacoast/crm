"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { lookupRecords, type LookupResult } from "@/app/(app)/lookup-actions";

/**
 * Type-to-search box for choosing a contact or company.
 * Submits the chosen record's id in a hidden field called `name`.
 */
export function RecordPicker({
  name,
  kind,
  initial,
  placeholder,
  invalid,
}: {
  name: string;
  kind: "contact" | "company";
  initial: { id: string; label: string } | null;
  placeholder: string;
  invalid?: boolean;
}) {
  const [selected, setSelected] = useState(initial);
  const [text, setText] = useState("");
  const [results, setResults] = useState<LookupResult[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [pending, startTransition] = useTransition();
  const listId = useId();
  const latest = useRef(0);

  useEffect(() => {
    if (text.trim().length < 2) return;
    const ticket = ++latest.current;
    const timer = setTimeout(() => {
      startTransition(async () => {
        const r = await lookupRecords(kind, text);
        if (ticket === latest.current) {
          setResults(r);
          setActive(0);
          setOpen(true);
        }
      });
    }, 250);
    return () => clearTimeout(timer);
  }, [text, kind]);

  const choose = (r: LookupResult) => {
    setSelected({ id: r.id, label: r.label });
    setText("");
    setResults([]);
    setOpen(false);
  };

  if (selected) {
    return (
      <div className="flex h-8 items-center justify-between gap-2 rounded-lg border border-input px-2.5 text-sm">
        <input type="hidden" name={name} value={selected.id} />
        <span className="truncate">{selected.label}</span>
        <Button type="button" variant="ghost" size="xs" onClick={() => setSelected(null)}>
          Change
        </Button>
      </div>
    );
  }

  return (
    <div className="relative">
      <input type="hidden" name={name} value="" />
      <Input
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-invalid={invalid}
        value={text}
        placeholder={placeholder}
        onChange={(e) => {
          setText(e.target.value);
          if (e.target.value.trim().length < 2) {
            setResults([]);
            setOpen(false);
          }
        }}
        onKeyDown={(e) => {
          if (!open || results.length === 0) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => Math.min(a + 1, results.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === "Enter") {
            e.preventDefault();
            choose(results[active]);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-border bg-popover p-1 text-sm shadow-md"
        >
          {results.length === 0 && (
            <li className="px-2 py-1.5 text-muted-foreground">{pending ? "Searching…" : "No matches"}</li>
          )}
          {results.map((r, i) => (
            <li
              key={r.id}
              role="option"
              aria-selected={i === active}
              className={`cursor-pointer rounded-md px-2 py-1.5 ${i === active ? "bg-muted" : ""}`}
              onMouseDown={(e) => {
                e.preventDefault();
                choose(r);
              }}
              onMouseEnter={() => setActive(i)}
            >
              <div>{r.label}</div>
              {r.detail && <div className="text-xs text-muted-foreground">{r.detail}</div>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
