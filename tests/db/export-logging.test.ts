import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminClient, anonClient, assertNotProduction, createTestUser, deleteTestUsers, type TestUser } from "./helpers";

assertNotProduction();

const admin = adminClient();
let member: TestUser;
let boss: TestUser;

beforeAll(async () => {
  member = await createTestUser(admin, "export-member");
  boss = await createTestUser(admin, "export-admin");
  await admin.from("profiles").update({ role: "admin" }).eq("id", boss.id);
});

afterAll(async () => {
  await deleteTestUsers(admin, [member, boss]);
});

describe("export logging", () => {
  it("an admin's export is recorded with who, what, how many rows and which filters", async () => {
    const { error } = await boss.client.rpc("log_export", {
      p_table: "contacts",
      p_row_count: 42,
      p_filters: { q: "jane", type: "lead", archived: false },
    });
    expect(error).toBeNull();
    const { data } = await admin
      .from("activity_log")
      .select("*")
      .eq("actor_id", boss.id)
      .eq("action", "export")
      .single();
    expect(data!.table_name).toBe("contacts");
    expect(data!.actor_type).toBe("user");
    expect(data!.context).toEqual({ rows: 42, filters: { q: "jane", type: "lead", archived: false } });
  });

  it("members can't record exports (they can't export)", async () => {
    const { error } = await member.client.rpc("log_export", { p_table: "contacts", p_row_count: 1, p_filters: {} });
    expect(error?.message).toMatch(/Only admins/);
  });

  it("logged-out visitors can't call it at all", async () => {
    const { error } = await anonClient().rpc("log_export", { p_table: "contacts", p_row_count: 1, p_filters: {} });
    expect(error).not.toBeNull();
  });

  it("rejects unknown tables and nonsense row counts", async () => {
    const a = await boss.client.rpc("log_export", { p_table: "profiles", p_row_count: 1, p_filters: {} });
    expect(a.error).not.toBeNull();
    const b = await boss.client.rpc("log_export", { p_table: "deals", p_row_count: -1, p_filters: {} });
    expect(b.error).not.toBeNull();
  });
});
