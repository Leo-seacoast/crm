import { describe, expect, it } from "vitest";
import { cleanRow, guessMapping, lookupBatches, planRows, resolveTimeZone, splitName, summarise } from "./ghl-contacts";
import { parseGhlDate } from "./dates";
import { importBatchSchema } from "./import-row-schema";

const GHL_HEADERS = [
  "Contact Id", "First Name", "Last Name", "Contact name", "Phone", "Email", "Business Name",
  "Created (EST)", "Last Activity (EST)", "Tags", "DND", "Unique Member Code", "Member Since",
  "Renewal Date", "Credits Earned", "Credits Used", "Total Perks Usage", "Unique Referral Code",
  "Credits Available", "Referral code used", "",
];

describe("recognising GHL columns", () => {
  const m = guessMapping(GHL_HEADERS);

  it("maps GHL's standard columns", () => {
    expect(m["First Name"]).toBe("first_name");
    expect(m["Last Name"]).toBe("last_name");
    expect(m["Phone"]).toBe("phone");
    expect(m["Email"]).toBe("email");
    expect(m["Business Name"]).toBe("company_name");
    expect(m["Created (EST)"]).toBe("created_at");
    expect(m["Tags"]).toBe("tags");
    expect(m["DND"]).toBe("dnd_all");
  });

  it("keeps the membership fields and other unknown columns as extra fields", () => {
    for (const h of ["Unique Member Code", "Renewal Date", "Credits Available", "Last Activity (EST)"]) {
      expect(m[h]).toBe("extra");
    }
  });

  it("recognises the GHL contact ID", () => {
    expect(m["Contact Id"]).toBe("ghl_id");
  });

  it("doesn't split 'Contact name' when first/last names exist; ignores blank headers", () => {
    expect(m["Contact name"]).toBe("extra");
    expect(m[""]).toBe("ignore");
  });

  it("splits a full name when that's all there is", () => {
    expect(guessMapping(["Contact name", "Email"])["Contact name"]).toBe("full_name");
    expect(splitName("Mary Ann Smith")).toEqual({ first: "Mary Ann", last: "Smith" });
    expect(splitName("Cher")).toEqual({ first: "Cher", last: null });
  });
});

describe("cleaning a GHL row", () => {
  const mapping = guessMapping(GHL_HEADERS);
  const base = {
    "First Name": "Jane", "Last Name": "Doe", Phone: "(603) 555-0123", Email: " Jane@Example.COM ",
    "Business Name": "Acme Rentals", "Created (EST)": "2024-03-05 14:30:00", Tags: "vip, owner, vip",
    DND: "", "Unique Member Code": "M-1042", "Credits Available": "35", "Member Since": "",
  };

  it("tidies names, email, phone, tags and keeps extra fields", () => {
    const r = cleanRow(base, mapping, 2);
    expect(r.problems).toEqual([]);
    expect(r.contact).toMatchObject({
      first_name: "Jane", last_name: "Doe", email: "jane@example.com", phone: "+16035550123",
      company_name: "Acme Rentals", tags: ["vip", "owner"], email_consent: "unknown", sms_consent: "unknown",
    });
    expect(r.contact!.extra_fields).toEqual({ "Unique Member Code": "M-1042", "Credits Available": "35" });
    expect(r.contact!.ghl_id).toBeNull(); // no Contact Id in this row
  });

  it("reads the GHL date in Eastern time", () => {
    expect(cleanRow(base, mapping, 2).contact!.created_at).toBe("2024-03-05T19:30:00.000Z");
  });

  it("turns DND into an opt-out, and never into an opt-in", () => {
    const r = cleanRow({ ...base, DND: "true" }, mapping, 2);
    expect(r.contact!.email_consent).toBe("opted_out");
    expect(r.contact!.sms_consent).toBe("opted_out");
    expect(cleanRow({ ...base, DND: "false" }, mapping, 2).contact!.email_consent).toBe("unknown");
  });

  it("blanks invalid emails/phones with a warning instead of failing", () => {
    const r = cleanRow({ ...base, Email: "not-an-email", Phone: "123" }, mapping, 3);
    expect(r.contact!.email).toBeNull();
    expect(r.contact!.phone).toBeNull();
    expect(r.warnings).toHaveLength(2);
  });

  it("can't import a row with no name, email or phone", () => {
    const r = cleanRow({ "Unique Member Code": "M-1" }, mapping, 4);
    expect(r.contact).toBeNull();
    expect(r.problems).toEqual(["No name, email or phone"]);
  });

  it("shortens over-long values instead of failing", () => {
    const r = cleanRow({ ...base, "First Name": "x".repeat(150) }, mapping, 5);
    expect(r.contact!.first_name).toHaveLength(100);
    expect(r.warnings[0]).toMatch(/shortened/);
  });
});

describe("time zones as exports write them", () => {
  it("understands names, abbreviations and the (GMT) style", () => {
    expect(resolveTimeZone("America/New_York")).toBe("America/New_York");
    expect(resolveTimeZone("Eastern Time")).toBe("America/New_York");
    expect(resolveTimeZone("Eastern Standard Time")).toBe("America/New_York");
    expect(resolveTimeZone("EST")).toBe("America/New_York");
    expect(resolveTimeZone("Pacific")).toBe("America/Los_Angeles");
    expect(resolveTimeZone("(GMT-06:00) America/Chicago")).toBe("America/Chicago");
    expect(resolveTimeZone("Hawaii Time")).toBe("Pacific/Honolulu");
  });
  it("leaves unknown values blank", () => {
    expect(resolveTimeZone("Moon Time")).toBeNull();
    expect(resolveTimeZone("")).toBeNull();
  });
});

describe("GHL dates", () => {
  it("understands the formats GHL uses", () => {
    expect(parseGhlDate("2024-03-05 14:30")).toBe("2024-03-05T19:30:00.000Z");
    expect(parseGhlDate("03/05/2024 2:30 PM")).toBe("2024-03-05T19:30:00.000Z");
    expect(parseGhlDate("Mar 5, 2024 2:30 pm")).toBe("2024-03-05T19:30:00.000Z");
    expect(parseGhlDate("2024-07-04")).toBe("2024-07-04T04:00:00.000Z"); // summer: EDT is UTC-4
    expect(parseGhlDate("2024-03-05T14:30:00Z")).toBe("2024-03-05T14:30:00.000Z");
  });

  it("rejects nonsense", () => {
    for (const bad of ["", "yesterday", "2024-02-30", "13/45/2024", "Foo 5 2024", undefined]) {
      expect(parseGhlDate(bad)).toBeNull();
    }
  });
});

describe("planning: duplicates and matches", () => {
  const mapping = guessMapping(["First Name", "Email", "Phone"]);
  const rows = [
    cleanRow({ "First Name": "A", Email: "a@example.com" }, mapping, 2),
    cleanRow({ "First Name": "A again", Email: "A@example.com" }, mapping, 3),
    cleanRow({ "First Name": "B", Phone: "6035550199" }, mapping, 4),
    cleanRow({ "First Name": "C", Email: "c@example.com", Phone: "6035550198" }, mapping, 5),
    cleanRow({ "First Name": "D", Email: "d@example.com" }, mapping, 6),
    cleanRow({}, mapping, 7),
  ];
  const existing = [
    { id: "11111111-1111-4111-8111-111111111111", email: null, phone: "+16035550199", ghl_id: null, name: "Bea" },
    { id: "22222222-2222-4222-8222-222222222222", email: "c@example.com", phone: null, ghl_id: null, name: "Cal" },
    { id: "33333333-3333-4333-8333-333333333333", email: null, phone: "+16035550198", ghl_id: null, name: "Cy" },
  ];

  it("matches by GHL ID even when there's no email or phone", () => {
    const idMap = guessMapping(["Contact Id", "First Name"]);
    const rows2 = [
      cleanRow({ "Contact Id": "ghl_1", "First Name": "Only a name" }, idMap, 2),
      cleanRow({ "Contact Id": "ghl_1", "First Name": "Same person again" }, idMap, 3),
    ];
    const plan = planRows(rows2, [{ id: existing[0].id, email: null, phone: null, ghl_id: "ghl_1", name: "Bea" }], "fill_blanks");
    expect(plan[0]).toMatchObject({ action: "update", targetId: existing[0].id });
    expect(plan[1]).toMatchObject({ action: "skip" });
    expect(plan[1].reason).toMatch(/Same GHL ID as row 2/);
  });

  it("fills in existing contacts, skips in-file duplicates and conflicting matches", () => {
    const plan = planRows(rows, existing, "fill_blanks");
    expect(plan.map((p) => p.action)).toEqual(["create", "skip", "update", "skip", "create", "skip"]);
    expect(plan[1].reason).toMatch(/row 2/);
    expect(plan[2].targetId).toBe(existing[0].id);
    expect(plan[3].reason).toMatch(/check by hand/);
    expect(summarise(plan)).toMatchObject({ create: 2, update: 1, skip: 3 });
  });

  it("can skip existing contacts instead", () => {
    const plan = planRows(rows, existing, "skip");
    expect(plan[2].action).toBe("skip");
    expect(plan[2].reason).toMatch(/Already in the CRM/);
  });
});

describe("duplicate-check lookups", () => {
  it("never asks about more than the limit at once (the database caps answers at 1,000)", () => {
    const keys = {
      emails: Array.from({ length: 1500 }, (_, i) => `e${i}@example.com`),
      phones: Array.from({ length: 100 }, (_, i) => `+1603555${String(i).padStart(4, "0")}`),
      ghlIds: Array.from({ length: 1600 }, (_, i) => `ghl_${i}`),
    };
    const batches = lookupBatches(keys, 900);
    for (const b of batches) expect(b.emails.length + b.phones.length + b.ghlIds.length).toBeLessThanOrEqual(900);
    const total = batches.reduce((n, b) => n + b.emails.length + b.phones.length + b.ghlIds.length, 0);
    expect(total).toBe(3200); // nothing lost
    expect(lookupBatches({ emails: [], phones: [], ghlIds: [] }, 900)).toEqual([]);
  });
});

describe("server-side check of import rows", () => {
  const good = {
    row: 2, action: "create", ghl_id: "ghl_abc", first_name: "Jane", last_name: null, email: "jane@example.com",
    phone: "+16035550123", company_id: null, types: ["lead"], tags: [], created_at: "2024-03-05T19:30:00.000Z",
    address_line1: null, address_line2: null, city: null, region: null, postal_code: null, country: null,
    time_zone: null, source: "GHL import", email_consent: "unknown", sms_consent: "opted_out", extra_fields: { Code: "M-1" },
  };

  it("accepts a clean row", () => {
    expect(importBatchSchema.safeParse([good]).success).toBe(true);
  });

  it("refuses opt-ins, unknown fields, bad phones and oversized batches", () => {
    expect(importBatchSchema.safeParse([{ ...good, email_consent: "opted_in" }]).success).toBe(false);
    expect(importBatchSchema.safeParse([{ ...good, created_by: "someone" }]).success).toBe(false);
    expect(importBatchSchema.safeParse([{ ...good, phone: "603-555-0123" }]).success).toBe(false);
    expect(importBatchSchema.safeParse([{ ...good, action: "update" }]).success).toBe(false);
    expect(importBatchSchema.safeParse(Array(201).fill(good)).success).toBe(false);
    expect(importBatchSchema.safeParse([]).success).toBe(false);
  });
});
