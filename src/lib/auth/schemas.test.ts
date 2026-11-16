import { describe, expect, it } from "vitest";
import { loginSchema } from "./schemas";

describe("login form checks", () => {
  it("accepts a normal email and password, tidying the email", () => {
    const r = loginSchema.parse({ email: "  Owner@Example.com ", password: "correct horse battery" });
    expect(r.email).toBe("owner@example.com");
  });

  it("rejects a bad email", () => {
    expect(loginSchema.safeParse({ email: "nope", password: "x" }).success).toBe(false);
  });

  it("rejects an empty or absurdly long password", () => {
    expect(loginSchema.safeParse({ email: "a@b.co", password: "" }).success).toBe(false);
    expect(loginSchema.safeParse({ email: "a@b.co", password: "x".repeat(201) }).success).toBe(false);
  });

  it("rejects missing fields", () => {
    expect(loginSchema.safeParse({}).success).toBe(false);
  });
});
