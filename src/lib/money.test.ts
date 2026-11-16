import { describe, expect, it } from "vitest";
import { formatMoney, parseMoney } from "./money";

describe("parseMoney", () => {
  it("accepts the ways people type amounts", () => {
    expect(parseMoney("12500")).toEqual({ ok: true, value: 12500 });
    expect(parseMoney("$12,500.50")).toEqual({ ok: true, value: 12500.5 });
    expect(parseMoney(" 0 ")).toEqual({ ok: true, value: 0 });
  });
  it("treats blank as no value", () => {
    expect(parseMoney("")).toEqual({ ok: true, value: null });
    expect(parseMoney(undefined)).toEqual({ ok: true, value: null });
  });
  it("rejects negatives, junk, too many decimals and huge numbers", () => {
    for (const bad of ["-5", "abc", "12.345", "1e5", "9999999999999", "12,50,0.5.5"]) {
      expect(parseMoney(bad).ok).toBe(false);
    }
  });
});

describe("formatMoney", () => {
  it("shows dollars neatly", () => {
    expect(formatMoney(12500)).toBe("$12,500");
    expect(formatMoney("12500.5")).toBe("$12,500.50");
    expect(formatMoney(null)).toBe("");
  });
});
