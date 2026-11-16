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

beforeAll(async () => {
  member = await createTestUser(admin, "log-member");
  boss = await createTestUser(admin, "log-admin");
  const { error } = await admin.from("profiles").update({ role: "admin" }).eq("id", boss.id);
  if (error) throw error;
});

afterAll(async () => {
  await deleteTestUsers(admin, [member, boss]);
});

async function entriesFor(recordId: string) {
  const { data, error } = await admin
    .from("activity_log")
    .select("*")
    .eq("record_id", recordId)
    .order("id", { ascending: true });
  if (error) throw error;
  return data;
}

describe("what gets recorded", () => {
  it("a new account is recorded as created, by the system", async () => {
    const log = await entriesFor(member.id);
    const created = log.find((e) => e.action === "create");
    expect(created).toBeDefined();
    expect(created?.table_name).toBe("profiles");
    expect(created?.actor_type).toBe("system");
  });

  it("a person's edit is recorded with who did it and exactly what changed", async () => {
    await member.client.from("profiles").update({ full_name: "Logged Name" }).eq("id", member.id);
    const log = await entriesFor(member.id);
    const update = log.at(-1)!;
    expect(update.action).toBe("update");
    expect(update.actor_type).toBe("user");
    expect(update.actor_id).toBe(member.id);
    expect(update.changes).toEqual({ full_name: { old: "Test log-member", new: "Logged Name" } });
  });

  it("saving without changing anything adds no noise", async () => {
    const before = (await entriesFor(member.id)).length;
    await member.client.from("profiles").update({ full_name: "Logged Name" }).eq("id", member.id);
    expect((await entriesFor(member.id)).length).toBe(before);
  });

  it("an admin changing a role is recorded against that admin", async () => {
    await boss.client.rpc("set_user_role", { target_user_id: member.id, new_role: "admin" });
    await boss.client.rpc("set_user_role", { target_user_id: member.id, new_role: "member" });
    const roleChanges = (await entriesFor(member.id)).filter(
      (e) => e.action === "update" && e.changes && "role" in (e.changes as object),
    );
    expect(roleChanges).toHaveLength(2);
    expect(roleChanges[0].actor_id).toBe(boss.id);
    expect(roleChanges[0].changes).toMatchObject({ role: { old: "member", new: "admin" } });
  });

  it("archiving and restoring are recorded as such", async () => {
    await admin.from("profiles").update({ archived_at: new Date().toISOString() }).eq("id", member.id);
    await admin.from("profiles").update({ archived_at: null }).eq("id", member.id);
    const actions = (await entriesFor(member.id)).map((e) => e.action);
    expect(actions.slice(-2)).toEqual(["archive", "restore"]);
  });
});

describe("standard fields can't be tampered with", () => {
  it("created date and creator never change; updated date moves forward", async () => {
    const { data: before } = await admin.from("profiles").select("*").eq("id", boss.id).single();
    await admin
      .from("profiles")
      .update({ created_at: "2000-01-01T00:00:00Z", created_by: member.id, full_name: "Boss" })
      .eq("id", boss.id);
    const { data: after } = await admin.from("profiles").select("*").eq("id", boss.id).single();
    expect(after?.created_at).toBe(before?.created_at);
    expect(after?.created_by).toBe(before?.created_by);
    expect(new Date(after!.updated_at).getTime()).toBeGreaterThan(new Date(before!.updated_at).getTime());
  });
});

describe("who can see the log", () => {
  it("logged-in members can read it", async () => {
    const { data, error } = await member.client.from("activity_log").select("id").eq("record_id", member.id);
    expect(error).toBeNull();
    expect((data ?? []).length).toBeGreaterThan(0);
  });

  it("logged-out visitors cannot", async () => {
    const { data, error } = await anonClient().from("activity_log").select("id").limit(1);
    expect(error !== null || (data ?? []).length === 0).toBe(true);
  });
});

describe("nobody can rewrite history", () => {
  it("members can't add fake entries", async () => {
    const { error } = await member.client.from("activity_log").insert({
      actor_type: "user",
      action: "update",
      table_name: "profiles",
    });
    expect(error).not.toBeNull();
  });

  it("admins can't edit or delete entries", async () => {
    const [entry] = await entriesFor(member.id);
    await boss.client.from("activity_log").update({ action: "tampered" }).eq("id", entry.id);
    await boss.client.from("activity_log").delete().eq("id", entry.id);
    const [still] = await entriesFor(member.id);
    expect(still).toEqual(entry);
  });

  it("even the full-access server key can't edit or delete entries", async () => {
    const [entry] = await entriesFor(member.id);
    const upd = await admin.from("activity_log").update({ action: "tampered" }).eq("id", entry.id);
    expect(upd.error).not.toBeNull();
    const del = await admin.from("activity_log").delete().eq("id", entry.id);
    expect(del.error).not.toBeNull();
    const [still] = await entriesFor(member.id);
    expect(still).toEqual(entry);
  });

  it("when an account is removed, its history stays (just without the name link)", async () => {
    const temp = await createTestUser(admin, "log-temp");
    await temp.client.from("profiles").update({ full_name: "Temp Renamed" }).eq("id", temp.id);
    const mine = (await entriesFor(temp.id)).find((e) => e.actor_id === temp.id);
    expect(mine).toBeDefined();

    await deleteTestUsers(admin, [temp]);

    const after = await entriesFor(temp.id);
    const kept = after.find((e) => e.id === mine!.id);
    expect(kept).toBeDefined();
    expect(kept?.actor_id).toBeNull();
    expect(kept?.changes).toEqual(mine?.changes);
    expect(after.at(-1)?.action).toBe("delete");
  });
});
