import { describe, expect, it } from "vitest";
import {
  applyContactFilters,
  filtersToQuery,
  parseCompanyFilters,
  parseContactFilters,
  parseDealFilters,
} from "./list-filters";

// A fake query that records which filters were applied.
class FakeQuery {
  calls: string[] = [];
  is(c: string) { this.calls.push(`is:${c}`); return this; }
  not(c: string) { this.calls.push(`not:${c}`); return this; }
  ilike(c: string, p: string) { this.calls.push(`ilike:${c}:${p}`); return this; }
  contains(c: string, v: string[]) { this.calls.push(`contains:${c}:${v.join()}`); return this; }
  eq(c: string, v: string) { this.calls.push(`eq:${c}:${v}`); return this; }
}

describe("list filters", () => {
  it("reads contact filters safely from the address bar", () => {
    expect(parseContactFilters({ q: " Jane% ", type: "owner", archived: "1" })).toEqual({
      q: "jane",
      type: "owner",
      archived: true,
    });
    expect(parseContactFilters({ type: "boss" }).type).toBeNull();
  });

  it("applies the same filters as the list page", () => {
    const q = applyContactFilters(new FakeQuery(), { q: "(603) 555", type: "lead", archived: false });
    expect(q.calls).toEqual(["is:archived_at", "contains:types:lead", "ilike:phone:%603555%"]);
  });

  it("ignores a pipeline that isn't a valid id", () => {
    expect(parseDealFilters({ pipeline: "x' or 1=1" }).pipeline).toBeNull();
  });

  it("builds the export link from the current filters", () => {
    expect(filtersToQuery({ ...parseCompanyFilters({ q: "acme" }) })).toBe("?q=acme");
    expect(filtersToQuery({ q: "", archived: false })).toBe("");
  });
});
