import { describe, expect, it } from "vitest";
import {
  actionLabel,
  actorLabel,
  describeChanges,
  formatValue,
  recordName,
  referencedIds,
  tableLabel,
} from "./format";

describe("who did it", () => {
  it("shows the person's name, falling back to email", () => {
    expect(actorLabel("user", { full_name: "Sam", email: "s@x.co" })).toBe("Sam");
    expect(actorLabel("user", { full_name: null, email: "s@x.co" })).toBe("s@x.co");
  });

  it("never disguises a removed person as 'System'", () => {
    expect(actorLabel("user", null)).toBe("A removed team member");
    expect(actorLabel("system", null)).toBe("System");
    expect(actorLabel("automation", null)).toBe("Automation");
  });
});

describe("activity log wording", () => {
  it("uses plain-English labels", () => {
    expect(tableLabel("profiles")).toBe("Team member");
    expect(tableLabel("pipeline_stages")).toBe("Stage");
    expect(tableLabel("some_new_table")).toBe("Some new table");
    expect(actionLabel("archive")).toBe("archived");
    expect(actionLabel("email_sent")).toBe("Email sent");
  });

  it("lists changed fields, hiding internal ones", () => {
    const changes = {
      full_name: { old: "Sam", new: "Samantha" },
      role: { old: "member", new: "admin" },
      updated_at: { old: "x", new: "y" },
      owner_id: { old: "a", new: "b" },
    };
    expect(describeChanges("update", changes)).toEqual([
      { field: "Full name", from: "Sam", to: "Samantha" },
      { field: "Role", from: "member", to: "admin" },
    ]);
  });

  it("shows nothing field-by-field for creates", () => {
    expect(describeChanges("create", { full_name: "Sam" })).toEqual([]);
  });

  it("copes with empty and long values", () => {
    expect(formatValue(null)).toBe("(empty)");
    expect(formatValue("")).toBe("(empty)");
    expect(formatValue("x".repeat(200))).toHaveLength(78);
    expect(formatValue("2026-11-16T13:31:24.448151+00:00")).toMatch(/Nov 16, 2026/);
  });

  it("finds a readable name for the record", () => {
    expect(recordName({ full_name: "Sam", email: "s@x.co" })).toBe("Sam");
    expect(recordName({ full_name: { old: "A", new: "B" } })).toBe("B");
    expect(recordName({ email: "s@x.co" })).toBe("s@x.co");
    expect(recordName(null)).toBeNull();
    expect(recordName({ first_name: "Jane", last_name: "Doe", email: "j@x.co" })).toBe("Jane Doe");
    expect(recordName({ name: "Acme" })).toBe("Acme");
  });

  it("shows stage names instead of internal ids", () => {
    const changes = { stage_id: { old: "s1", new: "s2" }, value: { old: 100, new: 200 } };
    const names = (id: string) => ({ s1: "Contacted", s2: "Proposal sent" })[id];
    expect(describeChanges("update", changes, names)).toEqual([
      { field: "Stage", from: "Contacted", to: "Proposal sent" },
      { field: "Value", from: "100", to: "200" },
    ]);
    expect(referencedIds([{ changes }, { changes: null }])).toEqual(["s1", "s2"]);
    expect(describeChanges("update", { stage_id: { old: "gone", new: "s2" } }, names)[0].from).toBe("(removed record)");
  });

  it("ignores malformed change data instead of crashing", () => {
    expect(describeChanges("update", "garbage")).toEqual([]);
    expect(describeChanges("update", [1, 2])).toEqual([]);
  });
});
