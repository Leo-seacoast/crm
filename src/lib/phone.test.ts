import { describe, expect, it } from "vitest";
import { formatPhone, normalizePhone } from "./phone";

describe("normalizePhone", () => {
  it("stores every way of typing the same US number identically", () => {
    for (const typed of ["(603) 555-0123", "603.555.0123", "603 555 0123", "+1 603-555-0123", "16035550123"]) {
      expect(normalizePhone(typed)).toEqual({ ok: true, value: "+16035550123" });
    }
  });

  it("keeps international numbers when the country code is given", () => {
    expect(normalizePhone("+44 20 7946 0958")).toEqual({ ok: true, value: "+442079460958" });
  });

  it("treats blank as 'no phone'", () => {
    expect(normalizePhone("")).toEqual({ ok: true, value: null });
    expect(normalizePhone("   ")).toEqual({ ok: true, value: null });
    expect(normalizePhone(null)).toEqual({ ok: true, value: null });
  });

  it("rejects junk", () => {
    for (const bad of ["123", "hello", "555-555", "+999 1234", "1".repeat(50), 42]) {
      expect(normalizePhone(bad).ok).toBe(false);
    }
  });
});

describe("formatPhone", () => {
  it("shows US numbers the familiar way", () => {
    expect(formatPhone("+16035550123")).toBe("(603) 555-0123");
  });
  it("shows foreign numbers with their country code", () => {
    expect(formatPhone("+442079460958")).toBe("+44 20 7946 0958");
  });
  it("handles empty", () => {
    expect(formatPhone(null)).toBe("");
  });
});
