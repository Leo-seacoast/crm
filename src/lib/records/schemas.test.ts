import { describe, expect, it } from "vitest";
import { companySchema, contactSchema, formDataToObject } from "./schemas";

const fd = (entries: [string, string][]) => {
  const f = new FormData();
  for (const [k, v] of entries) f.append(k, v);
  return f;
};

describe("contact form", () => {
  it("cleans up a normal submission", () => {
    const r = contactSchema.parse(
      formDataToObject(
        fd([
          ["first_name", " Jane "],
          ["last_name", ""],
          ["email", " Jane@Example.COM "],
          ["phone", "(603) 555-0123"],
          ["types", "lead"],
          ["types", "owner"],
          ["types", "lead"],
          ["tags", "vip, beach house ,vip"],
          ["time_zone", "America/New_York"],
          ["$ACTION_ID_abc", "x"],
        ]),
      ),
    );
    expect(r.first_name).toBe("Jane");
    expect(r.last_name).toBeNull();
    expect(r.email).toBe("jane@example.com");
    expect(r.phone).toBe("+16035550123");
    expect(r.types).toEqual(["lead", "owner"]);
    expect(r.tags).toEqual(["vip", "beach house"]);
    expect(r.email_consent).toBe("unknown");
    expect(r).not.toHaveProperty("$ACTION_ID_abc");
  });

  it("needs at least a name, email or phone", () => {
    const r = contactSchema.safeParse({});
    expect(r.success).toBe(false);
  });

  it("rejects bad email, phone, type and time zone", () => {
    expect(contactSchema.safeParse({ first_name: "A", email: "nope" }).success).toBe(false);
    expect(contactSchema.safeParse({ first_name: "A", phone: "123" }).success).toBe(false);
    expect(contactSchema.safeParse({ first_name: "A", types: ["boss"] }).success).toBe(false);
    expect(contactSchema.safeParse({ first_name: "A", time_zone: "Mars/Base" }).success).toBe(false);
  });

  it("requires 'how' whenever consent is recorded", () => {
    expect(contactSchema.safeParse({ first_name: "A", email_consent: "opted_in" }).success).toBe(false);
    expect(
      contactSchema.safeParse({ first_name: "A", email_consent: "opted_in", email_consent_source: "Verbal" })
        .success,
    ).toBe(true);
    expect(contactSchema.safeParse({ first_name: "A", sms_consent: "opted_out" }).success).toBe(false);
  });

  it("rejects a company id that isn't an id", () => {
    expect(contactSchema.safeParse({ first_name: "A", company_id: "1 or 1=1" }).success).toBe(false);
  });

  it("limits tags", () => {
    const many = Array.from({ length: 51 }, (_, i) => `t${i}`).join(",");
    expect(contactSchema.safeParse({ first_name: "A", tags: many }).success).toBe(false);
    expect(contactSchema.safeParse({ first_name: "A", tags: "x".repeat(51) }).success).toBe(false);
  });
});

describe("company form", () => {
  it("requires a name and tidies the website", () => {
    expect(companySchema.safeParse({ name: "  " }).success).toBe(false);
    const r = companySchema.parse({ name: "Acme", website: "acme.com" });
    expect(r.website).toBe("https://acme.com");
  });

  it("refuses non-web links", () => {
    expect(companySchema.safeParse({ name: "Acme", website: "javascript:alert(1)" }).success).toBe(false);
  });
});
