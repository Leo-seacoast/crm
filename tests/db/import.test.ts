import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminClient, assertNotProduction, createTestUser, deleteTestUsers, type TestUser } from "./helpers";

assertNotProduction();

const admin = adminClient();
let member: TestUser;
let boss: TestUser;
const tag = randomUUID().slice(0, 8);
const importIds: string[] = [];
let existingId: string; // a contact that's already in the CRM before the import
let existingCompanyId: string;

const email = (s: string) => `crm-test-imp-${s}-${tag}@example.com`;
const row = (n: number, extra: Record<string, unknown> = {}) => ({
  row: n, action: "create", ghl_id: null, first_name: `Imp${n}`, last_name: `Test ${tag}`, email: email(String(n)),
  phone: null, company_id: null, types: [], tags: ["ghl"], created_at: "2023-06-01T15:00:00.000Z",
  address_line1: null, address_line2: null, city: null, region: null, postal_code: null, country: null,
  time_zone: null, source: "GHL import", email_consent: "unknown", sms_consent: "unknown",
  extra_fields: { "Unique Member Code": `M-${n}` }, ...extra,
});

beforeAll(async () => {
  member = await createTestUser(admin, "imp-member");
  boss = await createTestUser(admin, "imp-admin");
  await admin.from("profiles").update({ role: "admin" }).eq("id", boss.id);

  const co = await admin.from("companies").insert({ name: `Existing Co ${tag}` }).select("id").single();
  existingCompanyId = co.data!.id;
  const c = await admin
    .from("contacts")
    .insert({
      first_name: "Already", last_name: `There ${tag}`, email: email("existing"), tags: ["vip"],
      extra_fields: { "Unique Member Code": "KEEP-ME" },
    })
    .select("id")
    .single();
  existingId = c.data!.id;
});

afterAll(async () => {
  for (const id of importIds) {
    await admin.from("contacts").delete().eq("import_id", id);
    await admin.from("companies").delete().eq("import_id", id);
  }
  await admin.from("contacts").delete().eq("id", existingId);
  await admin.from("companies").delete().eq("id", existingCompanyId);
  if (importIds.length) await admin.from("imports").delete().in("id", importIds);
  await deleteTestUsers(admin, [member, boss]);
});

async function start() {
  const { data, error } = await boss.client.rpc("start_import", {
    p_kind: "contacts", p_file_name: "ghl-test.csv", p_total_rows: 5, p_settings: {},
  });
  if (error) throw error;
  importIds.push(data as string);
  return data as string;
}

describe("who can import", () => {
  it("members can't start, run or undo imports, or see the import list", async () => {
    const s = await member.client.rpc("start_import", { p_kind: "contacts", p_file_name: "x.csv", p_total_rows: 1, p_settings: {} });
    expect(s.error?.message).toMatch(/Only admins/);

    const id = await start();
    const b = await member.client.rpc("import_contacts_batch", { p_import_id: id, p_rows: [row(1)] as never });
    expect(b.error?.message).toMatch(/Only admins/);
    const u = await member.client.rpc("undo_import_step", { p_import_id: id, p_limit: 1000 });
    expect(u.error?.message).toMatch(/Only admins/);
    const list = await member.client.from("imports").select("id");
    expect(list.data ?? []).toHaveLength(0);
  });
});

describe("a full import", () => {
  let importId: string;
  let newCompanyId: string;

  beforeAll(async () => {
    importId = await start();
  });

  it("re-uses existing companies (any capitalisation) and creates missing ones", async () => {
    const { data, error } = await boss.client.rpc("import_companies", {
      p_import_id: importId,
      p_names: [`EXISTING CO ${tag}`, `New Co ${tag}`, `new co ${tag}`],
    });
    expect(error).toBeNull();
    expect(data).toHaveLength(2);
    expect(data!.find((r) => r.name.startsWith("EXISTING"))!.id).toBe(existingCompanyId);
    newCompanyId = data!.find((r) => r.name.startsWith("New"))!.id;
    const { data: imp } = await admin.from("imports").select("companies_created").eq("id", importId).single();
    expect(imp!.companies_created).toBe(1);
  });

  it("creates contacts with the original GHL date, the admin as creator, and extra fields", async () => {
    const { data, error } = await boss.client.rpc("import_contacts_batch", {
      p_import_id: importId,
      p_rows: [row(1, { company_id: newCompanyId }), row(2, { email_consent: "opted_out", sms_consent: "opted_out" })] as never,
    });
    expect(error).toBeNull();
    expect(data).toMatchObject({ created: 2, updated: 0, errors: [] });

    const { data: c } = await admin.from("contacts").select("*").eq("email", email("1")).single();
    expect(c!.created_at.startsWith("2023-06-01")).toBe(true);
    expect(c!.created_by).toBe(boss.id);
    expect(c!.import_id).toBe(importId);
    expect(c!.company_id).toBe(newCompanyId);
    expect(c!.extra_fields).toEqual({ "Unique Member Code": "M-1" });
    expect(c!.email_consent).toBe("unknown");

    const { data: dnd } = await admin.from("contacts").select("*").eq("email", email("2")).single();
    expect(dnd!.email_consent).toBe("opted_out");
    expect(dnd!.sms_consent_source).toBe("GHL import (DND)");
  });

  it("records the import (and who ran it) in the activity log", async () => {
    const { data: c } = await admin.from("contacts").select("id").eq("email", email("1")).single();
    const { data: log } = await admin.from("activity_log").select("*").eq("record_id", c!.id).eq("action", "create").single();
    expect(log!.actor_id).toBe(boss.id);
    expect(log!.context).toMatchObject({ source: "ghl_import", import_id: importId });
  });

  it("fills in blanks on an existing contact without overwriting anything", async () => {
    const { data, error } = await boss.client.rpc("import_contacts_batch", {
      p_import_id: importId,
      p_rows: [
        row(3, {
          action: "update", target_id: existingId, first_name: "Overwritten?", email: email("existing"),
          city: "Portsmouth", tags: ["ghl", "vip"], email_consent: "opted_out",
          extra_fields: { "Unique Member Code": "NEW", "Renewal Date": "2025-01-01" },
        }),
      ] as never,
    });
    expect(error).toBeNull();
    expect(data).toMatchObject({ updated: 1 });

    const { data: c } = await admin.from("contacts").select("*").eq("id", existingId).single();
    expect(c!.first_name).toBe("Already"); // not overwritten
    expect(c!.city).toBe("Portsmouth"); // blank filled in
    expect([...c!.tags].sort()).toEqual(["ghl", "vip"]);
    expect(c!.extra_fields).toEqual({ "Unique Member Code": "KEEP-ME", "Renewal Date": "2025-01-01" });
    expect(c!.email_consent).toBe("opted_out"); // DND in GHL is respected
    expect(c!.import_id).toBeNull(); // not "created by" the import, so Undo leaves it alone
  });

  it("reports bad rows without failing the rest of the batch", async () => {
    const { data } = await boss.client.rpc("import_contacts_batch", {
      p_import_id: importId,
      p_rows: [
        row(4, { email: email("1") }), // duplicate of row 1
        row(5, { email_consent: "opted_in" }), // imports can't opt anyone in
        row(6, { time_zone: "Mars/Base" }),
        row(7),
      ] as never,
    });
    const r = data as { created: number; errors: { row: number; message: string }[] };
    expect(r.created).toBe(1);
    expect(r.errors.map((e) => e.row)).toEqual([4, 5, 6]);
    expect(r.errors[0].message).toMatch(/already has this email/);
    expect(r.errors[1].message).toMatch(/cannot mark anyone as opted in/);
  });

  it("finishing records the totals, and a finished import can't take more rows", async () => {
    const f = await boss.client.rpc("finish_import", { p_import_id: importId, p_skipped_in_preview: 2 });
    expect(f.error).toBeNull();
    const { data: imp } = await admin.from("imports").select("*").eq("id", importId).single();
    expect(imp).toMatchObject({ status: "completed", created_count: 3, updated_count: 1, error_count: 3, skipped_count: 2 });

    const more = await boss.client.rpc("import_contacts_batch", { p_import_id: importId, p_rows: [row(8)] as never });
    expect(more.error?.message).toMatch(/not open/);
  });

  it("undo archives what the import created, leaves existing records and shared companies alone", async () => {
    // Someone links an existing contact to the imported company: it must survive the undo.
    await admin.from("contacts").update({ company_id: newCompanyId }).eq("id", existingId);

    // Undo runs in steps; with a step size of 2 it takes two steps for 3 contacts.
    const step1 = await boss.client.rpc("undo_import_step", { p_import_id: importId, p_limit: 2 });
    expect(step1.error).toBeNull();
    expect(step1.data).toMatchObject({ archived: 2, remaining: 1, done: false });
    const step2 = await boss.client.rpc("undo_import_step", { p_import_id: importId, p_limit: 2 });
    expect(step2.data).toMatchObject({ archived: 1, remaining: 0, done: true });
    const { data: imp } = await admin.from("imports").select("status").eq("id", importId).single();
    expect(imp!.status).toBe("undone");

    const { data: created } = await admin.from("contacts").select("archived_at").eq("import_id", importId);
    expect(created!.every((c) => c.archived_at !== null)).toBe(true);
    const { data: existing } = await admin.from("contacts").select("archived_at").eq("id", existingId).single();
    expect(existing!.archived_at).toBeNull();
    const { data: company } = await admin.from("companies").select("archived_at").eq("id", newCompanyId).single();
    expect(company!.archived_at).toBeNull();

    const again = await boss.client.rpc("undo_import_step", { p_import_id: importId, p_limit: 1000 });
    expect(again.error?.message).toMatch(/already undone/);
  });
});

describe("normal app use is unchanged", () => {
  it("a person adding a contact still can't set its creation date", async () => {
    const { data } = await boss.client
      .from("contacts")
      .insert({ first_name: "Plain", last_name: `Add ${tag}`, created_at: "2000-01-01T00:00:00Z" })
      .select("id, created_at")
      .single();
    expect(data!.created_at.startsWith("2000")).toBe(false);
    await admin.from("contacts").delete().eq("id", data!.id);
  });
});
