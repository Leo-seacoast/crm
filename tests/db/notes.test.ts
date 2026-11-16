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
let alice: TestUser; // member
let bob: TestUser; // another member
let boss: TestUser; // admin
let contactId: string;
let companyId: string;
const tag = randomUUID().slice(0, 8);

beforeAll(async () => {
  alice = await createTestUser(admin, "notes-alice");
  bob = await createTestUser(admin, "notes-bob");
  boss = await createTestUser(admin, "notes-admin");
  await admin.from("profiles").update({ role: "admin" }).eq("id", boss.id);
  const c = await admin
    .from("contacts")
    .insert({ first_name: "Note", last_name: `Target ${tag}`, email: `crm-test-note-${tag}@example.com` })
    .select("id")
    .single();
  contactId = c.data!.id;
  const co = await admin.from("companies").insert({ name: `Notes Co ${tag}` }).select("id").single();
  companyId = co.data!.id;
});

afterAll(async () => {
  await admin.from("notes").delete().in("contact_id", [contactId]);
  await admin.from("notes").delete().in("company_id", [companyId]);
  await admin.from("contacts").delete().eq("id", contactId);
  await admin.from("companies").delete().eq("id", companyId);
  await deleteTestUsers(admin, [alice, bob, boss]);
});

async function aliceNote(body = "Prefers texts") {
  const { data, error } = await alice.client
    .from("notes")
    .insert({ body, contact_id: contactId })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

describe("adding notes", () => {
  it("a member can add a note; author and date can't be faked", async () => {
    const { data, error } = await alice.client
      .from("notes")
      .insert({ body: "Gate code changes monthly", contact_id: contactId, created_by: bob.id, created_at: "2000-01-01T00:00:00Z" })
      .select("*")
      .single();
    expect(error).toBeNull();
    expect(data!.created_by).toBe(alice.id);
    expect(data!.created_at.startsWith("2000")).toBe(false);
  });

  it("a note belongs to exactly one record", async () => {
    const none = await alice.client.from("notes").insert({ body: "Orphan" });
    expect(none.error).not.toBeNull();
    const two = await alice.client.from("notes").insert({ body: "Two", contact_id: contactId, company_id: companyId });
    expect(two.error).not.toBeNull();
  });

  it("empty notes are rejected", async () => {
    const r = await alice.client.from("notes").insert({ body: "   ", contact_id: contactId });
    expect(r.error).not.toBeNull();
  });

  it("logged-out visitors can't read or add notes", async () => {
    const anon = anonClient();
    const read = await anon.from("notes").select("id").limit(1);
    expect(read.error !== null || (read.data ?? []).length === 0).toBe(true);
    const add = await anon.from("notes").insert({ body: "spam", contact_id: contactId });
    expect(add.error).not.toBeNull();
  });

  it("a trusted import can keep a note's original date (for the GHL import)", async () => {
    const { data, error } = await admin
      .from("notes")
      .insert({ body: "Imported from GHL", company_id: companyId, created_at: "2024-03-05T10:00:00Z" })
      .select("created_at")
      .single();
    expect(error).toBeNull();
    expect(data!.created_at.startsWith("2024-03-05")).toBe(true);
  });
});

describe("editing", () => {
  it("the author can edit their note, and the old wording stays in the history", async () => {
    const note = await aliceNote("Call after 5pm");
    const r = await alice.client.from("notes").update({ body: "Call after 6pm" }).eq("id", note.id);
    expect(r.error).toBeNull();
    const { data: log } = await admin
      .from("activity_log")
      .select("changes")
      .eq("record_id", note.id)
      .eq("action", "update")
      .single();
    expect(log!.changes).toMatchObject({ body: { old: "Call after 5pm", new: "Call after 6pm" } });
  });

  it("other members can't change someone else's wording", async () => {
    const note = await aliceNote();
    const r = await bob.client.from("notes").update({ body: "Changed by Bob" }).eq("id", note.id);
    expect(r.error?.message).toMatch(/Only the author/);
  });

  it("not even an admin can change someone else's wording", async () => {
    const note = await aliceNote();
    const r = await boss.client.from("notes").update({ body: "Changed by admin" }).eq("id", note.id);
    expect(r.error?.message).toMatch(/Only the author/);
  });

  it("anyone can pin or unpin", async () => {
    const note = await aliceNote();
    const r = await bob.client.from("notes").update({ pinned: true }).eq("id", note.id).select("pinned").single();
    expect(r.data!.pinned).toBe(true);
  });

  it("a note can't be moved to another record", async () => {
    const note = await aliceNote();
    const r = await alice.client.from("notes").update({ contact_id: null, company_id: companyId }).eq("id", note.id);
    expect(r.error).not.toBeNull();
  });
});

describe("archiving", () => {
  it("other members can't archive someone else's note", async () => {
    const note = await aliceNote();
    const r = await bob.client.from("notes").update({ archived_at: new Date().toISOString() }).eq("id", note.id);
    expect(r.error?.message).toMatch(/Only the author or an admin/);
  });

  it("the author can archive their note, but not restore it", async () => {
    const note = await aliceNote();
    const arch = await alice.client
      .from("notes")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", note.id)
      .select("id");
    expect(arch.data).toHaveLength(1);
    const restore = await alice.client.from("notes").update({ archived_at: null }).eq("id", note.id).select("id");
    expect(restore.data ?? []).toHaveLength(0);
  });

  it("an admin can archive anyone's note and restore it", async () => {
    const note = await aliceNote();
    const arch = await boss.client
      .from("notes")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", note.id)
      .select("id");
    expect(arch.data).toHaveLength(1);
    const restore = await boss.client.from("notes").update({ archived_at: null }).eq("id", note.id).select("id");
    expect(restore.data).toHaveLength(1);
  });

  it("nobody can permanently delete a note through the app", async () => {
    const note = await aliceNote();
    await alice.client.from("notes").delete().eq("id", note.id);
    await boss.client.from("notes").delete().eq("id", note.id);
    const { data } = await admin.from("notes").select("id").eq("id", note.id);
    expect(data).toHaveLength(1);
  });
});
