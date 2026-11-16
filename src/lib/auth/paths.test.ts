import { describe, expect, it } from "vitest";
import { isPublicPath, safeNextPath } from "./paths";

describe("isPublicPath", () => {
  it("only the login page is public", () => {
    expect(isPublicPath("/login")).toBe(true);
    expect(isPublicPath("/")).toBe(false);
    expect(isPublicPath("/contacts")).toBe(false);
    expect(isPublicPath("/loginx")).toBe(false);
  });
});

describe("safeNextPath (where to go after login)", () => {
  it("allows pages inside the app", () => {
    expect(safeNextPath("/contacts")).toBe("/contacts");
    expect(safeNextPath("/deals?pipeline=1")).toBe("/deals?pipeline=1");
  });

  it("blocks other websites and tricks", () => {
    for (const bad of [
      "https://evil.example",
      "//evil.example",
      "/\\evil.example",
      "evil",
      "/x\r\nSet-Cookie: a=b",
      "",
      undefined,
      null,
      42,
    ]) {
      expect(safeNextPath(bad)).toBe("/");
    }
  });

  it("doesn't loop back to the login page", () => {
    expect(safeNextPath("/login")).toBe("/");
  });
});
