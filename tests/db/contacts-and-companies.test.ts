import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  adminClient,
  anonClient,
  assertNotProduction,
  createTestUser,
  deleteTestUsers,
  type TestUser,
} from "./helpers";

assertNotProduction();

const admin = adminClient();
let member: TestUser;
let boss: TestUser;
const createdContacts: string[] = [];
const createdCompanies: string[] = [];

const tag = randomUUID().slice(0, 8);
const email = (label: string) => `crm-test-${label}-${tag}@example.com`;
// 555-01xx numbers are reserved for fiction. Tests use area code 212 (demo data uses 603)
// and a random start, so they never clash with demo records or with each other.
let phoneCounter = 100 + Math.floor(Math.random() * 80);
const phone = () => `+1212555${String(phoneCounter++).padStart(4, "0")}`;

beforeAll(async () => {
  member = await createTestUser(admin, "cc-member");
  boss = await createTestUser(admin, "cc-admin");
  const { error } = await admin.from("profiles").update({ role: "admin" }).eq("id", boss.id);
  if (error) throw error;
});

afterAll(async () => {
  if (createdContacts.length) await admin.from("contacts").delete().in("id", createdContacts);
  if (createdCompanies.length) await admin.from("companies").delete().in("id", createdCompanies);
  await deleteTestUsers(admin, [member, boss]);
});

async function newContact(fields: Record<string, unknown> = {}, as: TestUser = member) {
  const { data, error } = await as.client
    .from("contacts")
    .insert({ first_name: "Test", email: email(randomUUID().slice(0, 6)), ...fields })
    .select("*")
    .single();
  if (data) createdContacts.push(data.id);
  return { data, error };
}

describe("logged-out visitors", () => {
  it("can't read or add contacts or companies", async () => {
    const anon = anonClient();
    const r1 = await anon.from("contacts").select("id").limit(1);
    expect(r1.error !== null || (r1.data ?? []).length === 0).toBe(true);
    const r2 = await anon.from("companies").select("id").limit(1);
    expect(r2.error !== null || (r2.data ?? []).length === 0).toBe(true);
    const r3 = await anon.from("contacts").insert({ first_name: "Spam" });
    expect(r3.error).not.toBeNull();
    const r4 = await anon.from("companies").insert({ name: "Spam" });
    expect(r4.error).not.toBeNull();
  });
});

describe("companies", () => {
  it("a member can add one; the database records the real creator", async () => {
    const { data, error } = await member.client
      .from("companies")
      .insert({ name: `Acme ${tag}`, created_by: boss.id, created_at: "2000-01-01T00:00:00Z" })
      .select("*")
      .single();
    expect(error).toBeNull();
    createdCompanies.push(data!.id);
    expect(data!.created_by).toBe(member.id); // not the faked boss.id
    expect(data!.owner_id).toBe(member.id);
    expect(data!.created_at.startsWith("2000")).toBe(false);
  });
});

describe("contacts: basics", () => {
  it("a member can add a contact with several types; creator can't be faked", async () => {
    const { data, error } = await newContact({
      types: ["lead", "owner", "lead"],
      created_by: boss.id,
      company_id: createdCompanies[0],
    });
    expect(error).toBeNull();
    expect(data!.types).toEqual(["lead", "owner"]);
    expect(data!.created_by).toBe(member.id);
  });

  it("is recorded in the activity log, without internal search columns", async () => {
    const { data } = await newContact({ last_name: "Logged" });
    const { data: log } = await admin
      .from("activity_log")
      .select("*")
      .eq("record_id", data!.id)
      .eq("action", "create")
      .single();
    expect(log?.actor_id).toBe(member.id);
    expect(log?.table_name).toBe("contacts");
    expect(log?.changes).not.toHaveProperty("search_text");
  });

  it("needs at least a name, email or phone", async () => {
    const { error } = await member.client.from("contacts").insert({});
    expect(error).not.toBeNull();
  });

  it("rejects badly formatted phones and unknown time zones", async () => {
    expect((await newContact({ phone: "603-555-0100" })).error).not.toBeNull();
    expect((await newContact({ time_zone: "Mars/Base" })).error).not.toBeNull();
    expect((await newContact({ time_zone: "America/New_York" })).error).toBeNull();
  });
});

describe("contacts: no duplicates", () => {
  it("blocks a second active contact with the same email (any capitalisation)", async () => {
    const e = email("dup");
    expect((await newContact({ email: e })).error).toBeNull();
    const second = await newContact({ email: e.toUpperCase() });
    expect(second.error?.code).toBe("23505");
  });

  it("blocks a second active contact with the same phone", async () => {
    const p = phone();
    expect((await newContact({ phone: p })).error).toBeNull();
    expect((await newContact({ phone: p })).error?.code).toBe("23505");
  });

  it("archived contacts don't block re-adding the same person", async () => {
    const e = email("rejoin");
    const first = await newContact({ email: e });
    await member.client.from("contacts").update({ archived_at: new Date().toISOString() }).eq("id", first.data!.id);
    expect((await newContact({ email: e })).error).toBeNull();
  });
});

describe("contacts: consent rules", () => {
  it("consent must say how it was given, and the time is set by the database", async () => {
    expect((await newContact({ email_consent: "opted_in" })).error).not.toBeNull();
    const { data, error } = await newContact({
      email_consent: "opted_in",
      email_consent_source: "Verbal (phone call)",
      email_consent_at: "2000-01-01T00:00:00Z",
    });
    expect(error).toBeNull();
    expect(data!.email_consent_at!.startsWith("2000")).toBe(false);
  });

  it("an opt-out can't be reversed or reset by a team member", async () => {
    const { data } = await newContact({ sms_consent: "opted_out", sms_consent_source: "Asked to stop" });
    const flip = await member.client
      .from("contacts")
      .update({ sms_consent: "opted_in", sms_consent_source: "trust me" })
      .eq("id", data!.id);
    expect(flip.error).not.toBeNull();
    const reset = await member.client.from("contacts").update({ sms_consent: "unknown" }).eq("id", data!.id);
    expect(reset.error).not.toBeNull();
  });

  it("not even an admin can reverse an opt-out in the app", async () => {
    const { data } = await newContact({ email_consent: "opted_out", email_consent_source: "Asked to stop" });
    const flip = await boss.client
      .from("contacts")
      .update({ email_consent: "opted_in", email_consent_source: "admin override" })
      .eq("id", data!.id);
    expect(flip.error).not.toBeNull();
  });

  it("a team member can record an opt-out", async () => {
    const { data } = await newContact({ email_consent: "opted_in", email_consent_source: "Website form" });
    const { error } = await member.client
      .from("contacts")
      .update({ email_consent: "opted_out", email_consent_source: "Asked to stop by phone" })
      .eq("id", data!.id);
    expect(error).toBeNull();
  });

  it("the record of when/how consent was given can't be rewritten", async () => {
    const { data } = await newContact({ email_consent: "opted_in", email_consent_source: "Website form" });
    await member.client
      .from("contacts")
      .update({ email_consent_source: "Something else", email_consent_at: "2001-01-01T00:00:00Z" })
      .eq("id", data!.id);
    const { data: after } = await admin.from("contacts").select("*").eq("id", data!.id).single();
    expect(after!.email_consent_source).toBe("Website form");
    expect(after!.email_consent_at).toBe(data!.email_consent_at);
  });

  it("trusted server processes (the contact's own form, later) can record a new opt-in", async () => {
    const { data } = await newContact({ email_consent: "opted_out", email_consent_source: "Asked to stop" });
    const { error } = await admin
      .from("contacts")
      .update({ email_consent: "opted_in", email_consent_source: "Contact re-subscribed via website form" })
      .eq("id", data!.id);
    expect(error).toBeNull();
  });
});

describe("archive, restore and delete", () => {
  it("members can archive, but not restore or edit archived contacts", async () => {
    const { data } = await newContact();
    const arch = await member.client
      .from("contacts")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", data!.id)
      .select("id");
    expect(arch.data).toHaveLength(1);

    const restore = await member.client
      .from("contacts")
      .update({ archived_at: null })
      .eq("id", data!.id)
      .select("id");
    expect(restore.data ?? []).toHaveLength(0);

    const edit = await member.client.from("contacts").update({ last_name: "Sneaky" }).eq("id", data!.id).select("id");
    expect(edit.data ?? []).toHaveLength(0);
  });

  it("admins can restore", async () => {
    const { data } = await newContact();
    await member.client.from("contacts").update({ archived_at: new Date().toISOString() }).eq("id", data!.id);
    const restore = await boss.client.from("contacts").update({ archived_at: null }).eq("id", data!.id).select("id");
    expect(restore.data).toHaveLength(1);
  });

  it("nobody can permanently delete through the app (not even admins)", async () => {
    const { data } = await newContact();
    await member.client.from("contacts").delete().eq("id", data!.id);
    await boss.client.from("contacts").delete().eq("id", data!.id);
    await boss.client.from("companies").delete().eq("id", createdCompanies[0]);
    const { data: c } = await admin.from("contacts").select("id").eq("id", data!.id);
    const { data: co } = await admin.from("companies").select("id").eq("id", createdCompanies[0]);
    expect(c).toHaveLength(1);
    expect(co).toHaveLength(1);
  });
});
