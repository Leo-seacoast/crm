import { describe, expect, it } from "vitest";
import type { ErrorEvent } from "@sentry/nextjs";
import { scrubEvent, sentryOptions } from "./sentry-options";

describe("Sentry privacy", () => {
  it("is switched off when no DSN is set (e.g. on a developer's computer)", () => {
    expect(sentryOptions(undefined, "development").enabled).toBe(false);
    expect(sentryOptions("https://key@o1.ingest.sentry.io/1", "staging").enabled).toBe(true);
  });

  it("never sends personal data", () => {
    expect(sentryOptions("x", "staging").sendDefaultPii).toBe(false);
  });

  it("removes user, cookies, form data, login headers and query strings", () => {
    const event = scrubEvent({
      type: undefined,
      user: { email: "jane@example.com" },
      request: {
        url: "https://crm.example/contacts?q=jane",
        cookies: { "sb-access-token": "secret" },
        data: { email: "jane@example.com" },
        query_string: "q=jane",
        headers: { Cookie: "a=b", Authorization: "Bearer x", "User-Agent": "Firefox" },
      },
      message: "Failed for jane@example.com",
      exception: { values: [{ type: "Error", value: "Duplicate phone +1 (603) 555-0123" }] },
    } as ErrorEvent)!;

    expect(event.user).toBeUndefined();
    expect(event.request?.cookies).toBeUndefined();
    expect(event.request?.data).toBeUndefined();
    expect(event.request?.query_string).toBeUndefined();
    expect(event.request?.url).toBe("https://crm.example/contacts");
    expect(event.request?.headers).toEqual({ "User-Agent": "Firefox" });
    expect(event.message).toBe("Failed for [email]");
    expect(event.exception?.values?.[0].value).toBe("Duplicate phone [phone]");
  });
});
