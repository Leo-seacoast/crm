import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminClient, anonClient, assertNotProduction, createTestUser, deleteTestUsers, type TestUser } from "./helpers";

assertNotProduction();

const admin = adminClient();
let member: TestUser;
let boss: TestUser;
let contactId: string;
let companyId: string;
const tag = randomUUID().slice(0, 8);
const taskIds: string[] = [];

beforeAll(async () => {
  member = await createTestUser(admin, "task-member");
  boss = await createTestUser(admin, "task-admin");
  await admin.from("profiles").update({ role: "admin" }).eq("id", boss.id);
  const c = await admin.from("contacts").insert({ first_name: "Task", last_name: `Target ${tag}` }).select("id").single();
  contactId = c.data!.id;
  const co = await admin.from("companies").insert({ name: `Task Co ${tag}` }).select("id").single();
  companyId = co.data!.id;
});

afterAll(async () => {
  if (taskIds.length) await admin.from("tasks").delete().in("id", taskIds);
  await admin.from("contacts").delete().eq("id", contactId);
  await admin.from("companies").delete().eq("id", companyId);
  await deleteTestUsers(admin, [member, boss]);
});

async function newTask(fields: Record<string, unknown> = {}, as: TestUser = member) {
  const { data, error } = await as.client
    .from("tasks")
    .insert({ title: `Follow up ${tag}`, due_date: "2026-11-20", ...fields })
    .select("*")
    .single();
  if (data) taskIds.push(data.id);
  return { data, error };
}

describe("tasks", () => {
  it("logged-out visitors can't read or add tasks", async () => {
    const r = await anonClient().from("tasks").select("id").limit(1);
    expect(r.error !== null || (r.data ?? []).length === 0).toBe(true);
    const w = await anonClient().from("tasks").insert({ title: "x", due_date: "2026-11-20" });
    expect(w.error).not.toBeNull();
  });

  it("a member can add a task linked to a contact; creator and owner can't be faked", async () => {
    const { data, error } = await newTask({ contact_id: contactId, created_by: boss.id, due_time: "14:30" });
    expect(error).toBeNull();
    expect(data!.created_by).toBe(member.id);
    expect(data!.owner_id).toBe(member.id);
    expect(data!.status).toBe("open");
    expect(data!.due_time).toBe("14:30:00");
  });

  it("a task links to at most one record, and can't be moved to another", async () => {
    const two = await newTask({ contact_id: contactId, company_id: companyId });
    expect(two.error).not.toBeNull();
    const { data } = await newTask({ contact_id: contactId });
    const move = await member.client.from("tasks").update({ contact_id: null, company_id: companyId }).eq("id", data!.id);
    expect(move.error?.message).toMatch(/can't be moved/);
  });

  it("marking done records when and who â€” set by the database, not the person", async () => {
    const { data } = await newTask({ completed_at: "2000-01-01T00:00:00Z" });
    expect(data!.completed_at).toBeNull();

    const done = await member.client
      .from("tasks")
      .update({ status: "done", completed_at: "2000-01-01T00:00:00Z", completed_by: boss.id })
      .eq("id", data!.id)
      .select("*")
      .single();
    expect(done.data!.completed_by).toBe(member.id);
    expect(done.data!.completed_at!.startsWith("2000")).toBe(false);

    const reopened = await member.client.from("tasks").update({ status: "open" }).eq("id", data!.id).select("*").single();
    expect(reopened.data!.completed_at).toBeNull();
    expect(reopened.data!.completed_by).toBeNull();
  });

  it("rejects empty titles and over-long details", async () => {
    expect((await newTask({ title: "  " })).error).not.toBeNull();
    expect((await newTask({ details: "x".repeat(2001) })).error).not.toBeNull();
  });

  it("members can archive but not restore; nobody can delete", async () => {
    const { data } = await newTask();
    const arch = await member.client.from("tasks").update({ archived_at: new Date().toISOString() }).eq("id", data!.id).select("id");
    expect(arch.data).toHaveLength(1);
    const restore = await member.client.from("tasks").update({ archived_at: null }).eq("id", data!.id).select("id");
    expect(restore.data ?? []).toHaveLength(0);
    await boss.client.from("tasks").delete().eq("id", data!.id);
    const { data: still } = await admin.from("tasks").select("id").eq("id", data!.id);
    expect(still).toHaveLength(1);
    const adminRestore = await boss.client.from("tasks").update({ archived_at: null }).eq("id", data!.id).select("id");
    expect(adminRestore.data).toHaveLength(1);
  });

  it("changes are recorded in the activity log", async () => {
    const { data } = await newTask();
    await member.client.from("tasks").update({ status: "done" }).eq("id", data!.id);
    const { data: log } = await admin.from("activity_log").select("action, actor_id, changes").eq("record_id", data!.id).order("id");
    expect(log!.map((l) => l.action)).toEqual(["create", "update"]);
    expect(log![1].actor_id).toBe(member.id);
    expect(log![1].changes).toMatchObject({ status: { old: "open", new: "done" } });
  });
});

describe("business settings", () => {
  it("everyone logged in can read them; there's exactly one row", async () => {
    const { data } = await member.client.from("app_settings").select("*");
    expect(data).toHaveLength(1);
    expect(data![0].time_zone).toBeTruthy();
    const second = await admin.from("app_settings").insert({});
    expect(second.error).not.toBeNull();
    const sneaky = await admin.from("app_settings").insert({ singleton: false });
    expect(sneaky.error).not.toBeNull();
  });

  it("members can't change them; admins can, but only to a real time zone", async () => {
    const { data: before } = await admin.from("app_settings").select("daily_summary_hour").single();
    const m = await member.client.from("app_settings").update({ daily_summary_hour: 3 }).eq("singleton", true).select("id");
    expect(m.data ?? []).toHaveLength(0);

    const bad = await boss.client.from("app_settings").update({ time_zone: "Mars/Base" }).eq("singleton", true);
    expect(bad.error).not.toBeNull();
    const badHour = await boss.client.from("app_settings").update({ daily_summary_hour: 24 }).eq("singleton", true);
    expect(badHour.error).not.toBeNull();

    const ok = await boss.client.from("app_settings").update({ daily_summary_hour: before!.daily_summary_hour }).eq("singleton", true).select("id");
    expect(ok.data).toHaveLength(1);
  });
});

describe("exports", () => {
  it("task exports can be recorded", async () => {
    const { error } = await boss.client.rpc("log_export", { p_table: "tasks", p_row_count: 3, p_filters: {} });
    expect(error).toBeNull();
  });
});
