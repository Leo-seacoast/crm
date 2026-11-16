import { describe, expect, it } from "vitest";
import { parsePublicEnv } from "./env";
import { getAppEnv, parseServerEnv } from "./env.server";

describe("getAppEnv", () => {
  it("reads the three known environments", () => {
    expect(getAppEnv({ APP_ENV: "staging" })).toBe("staging");
    expect(getAppEnv({ APP_ENV: "production" })).toBe("production");
  });
  it("treats missing or misspelled values as development (the safest)", () => {
    expect(getAppEnv({})).toBe("development");
    expect(getAppEnv({ APP_ENV: "prod" })).toBe("development");
  });
});

describe("public settings", () => {
  it("accepts a valid Supabase URL and key", () => {
    const env = parsePublicEnv({
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
    });
    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBe("https://example.supabase.co");
  });

  it("refuses to start with missing values, and says which file to fix", () => {
    expect(() => parsePublicEnv({})).toThrow(/\.env\.local/);
  });

  it("rejects a URL that isn't a URL", () => {
    expect(() =>
      parsePublicEnv({
        NEXT_PUBLIC_SUPABASE_URL: "not a url",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "x",
      }),
    ).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
  });
});

describe("server settings", () => {
  it("accepts the three known environments", () => {
    for (const APP_ENV of ["development", "staging", "production"]) {
      expect(parseServerEnv({ APP_ENV, SUPABASE_SECRET_KEY: "s" }).APP_ENV).toBe(APP_ENV);
    }
  });

  it("rejects an unknown environment name (typos must not silently count as production or dev)", () => {
    expect(() => parseServerEnv({ APP_ENV: "prod", SUPABASE_SECRET_KEY: "s" })).toThrow(/APP_ENV/);
  });

  it("requires the secret key", () => {
    expect(() => parseServerEnv({ APP_ENV: "development" })).toThrow(/SUPABASE_SECRET_KEY/);
  });
});
