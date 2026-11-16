import { describe, expect, it } from "vitest";
import { cleanSearch, pageNumber, phoneDigits } from "./search";

describe("cleanSearch", () => {
  it("keeps normal searches", () => {
    expect(cleanSearch("  Jane Smith ")).toBe("jane smith");
    expect(cleanSearch("jane@example.com")).toBe("jane@example.com");
  });

  it("strips characters that could alter the database query", () => {
    expect(cleanSearch("a%b_c*d")).toBe("a b c d");
    expect(cleanSearch("x),email.eq.y")).toBe("x email.eq.y");
    expect(cleanSearch('"quoted";')).toBe("quoted");
  });

  it("limits length and handles non-text", () => {
    expect(cleanSearch("a".repeat(500))).toHaveLength(100);
    expect(cleanSearch(undefined)).toBe("");
    expect(cleanSearch(["x"])).toBe("");
  });
});

describe("phoneDigits", () => {
  it("recognises partial phone numbers", () => {
    expect(phoneDigits("(603) 555")).toBe("603555");
    expect(phoneDigits("+1 603")).toBe("1603");
  });
  it("ignores normal words and very short numbers", () => {
    expect(phoneDigits("jane")).toBeNull();
    expect(phoneDigits("12")).toBeNull();
    expect(phoneDigits("unit 12b")).toBeNull();
  });
});

describe("pageNumber", () => {
  it("reads valid page numbers and falls back to 1", () => {
    expect(pageNumber("3")).toBe(3);
    for (const bad of ["0", "-2", "abc", undefined, "99999999"]) expect(pageNumber(bad)).toBe(1);
  });
});
