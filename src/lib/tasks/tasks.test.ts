import { describe, expect, it } from "vitest";
import { addDays, bucketFor, formatDue, taskSchema, todayIn } from "./tasks";

describe("today in the business time zone", () => {
  it("uses New York's date, not the server's (UTC)", () => {
    // 11:30 PM in New York on Nov 16 is already Nov 17 in UTC.
    const lateEvening = new Date("2026-11-17T04:30:00Z");
    expect(todayIn("America/New_York", lateEvening)).toBe("2026-11-16");
    expect(todayIn("UTC", lateEvening)).toBe("2026-11-17");
  });
});

describe("dates", () => {
  it("adds days across months and years", () => {
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("sorts tasks into overdue / today / upcoming / done", () => {
    const today = "2026-11-16";
    expect(bucketFor({ status: "open", due_date: "2026-11-15" }, today)).toBe("overdue");
    expect(bucketFor({ status: "open", due_date: "2026-11-16" }, today)).toBe("today");
    expect(bucketFor({ status: "open", due_date: "2026-11-17" }, today)).toBe("upcoming");
    expect(bucketFor({ status: "done", due_date: "2026-11-01" }, today)).toBe("done");
  });

  it("describes due dates in plain words", () => {
    const today = "2026-11-16"; // a Monday
    expect(formatDue("2026-11-16", null, today)).toBe("Today");
    expect(formatDue("2026-11-17", "14:30:00", today)).toBe("Tomorrow, 2:30 PM");
    expect(formatDue("2026-11-15", "00:05", today)).toBe("Yesterday, 12:05 AM");
    expect(formatDue("2026-11-20", null, today)).toBe("Fri, Nov 20");
    expect(formatDue("2027-01-05", null, today)).toBe("Jan 5, 2027");
  });
});

describe("task form checks", () => {
  it("accepts a normal task and tidies blanks", () => {
    const r = taskSchema.parse({ title: " Call Margaret ", due_date: "2026-11-20", due_time: "", details: "" });
    expect(r).toEqual({ title: "Call Margaret", details: null, due_date: "2026-11-20", due_time: null });
  });

  it("rejects missing titles, bad dates and bad times", () => {
    expect(taskSchema.safeParse({ title: "", due_date: "2026-11-20" }).success).toBe(false);
    expect(taskSchema.safeParse({ title: "X", due_date: "2026-02-30" }).success).toBe(false);
    expect(taskSchema.safeParse({ title: "X", due_date: "2026-11-20", due_time: "25:00" }).success).toBe(false);
    expect(taskSchema.safeParse({ title: "X".repeat(201), due_date: "2026-11-20" }).success).toBe(false);
  });
});
