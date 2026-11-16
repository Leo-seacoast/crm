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
let boss: TestUser; // a test admin

beforeAll(async () => {
  member = await createTestUser(admin, "member");
  boss = await createTestUser(admin, "admin");
  // Set-up only: promote the test admin with the full-access key.
  const { error } = await admin.from("profiles").update({ role: "admin" }).eq("id", boss.id);
  if (error) throw error;
});

afterAll(async () => {
  await deleteTestUsers(admin, [member, boss]);
});

describe("Supabase login settings", () => {
  it("public sign-up is switched off", async () => {
    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`, {
      headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY! },
    });
    const settings = await res.json();
    expect(settings.disable_signup, "Turn off 'Allow new users to sign up' in Supabase").toBe(true);
  });

  it("passwords shorter than 12 characters are rejected", async () => {
    const { error } = await member.client.auth.updateUser({ password: "Short1pass!" }); // 11 chars
    expect(error, "Set minimum password length to 12 in Supabase").not.toBeNull();
  });
});

describe("new accounts", () => {
  it("automatically get a profile, as a member", async () => {
    const { data } = await admin.from("profiles").select("role, email, full_name").eq("id", member.id).single();
    expect(data?.role).toBe("member");
    expect(data?.email).toBe(member.email);
    expect(data?.full_name).toBe("Test member");
  });
});

describe("logged-out visitors", () => {
  it("cannot see any profiles", async () => {
    const { data, error } = await anonClient().from("profiles").select("id");
    expect(error !== null || (data ?? []).length === 0).toBe(true);
  });

  it("cannot call the role-changing function", async () => {
    const { error } = await anonClient().rpc("set_user_role", {
      target_user_id: member.id,
      new_role: "admin",
    });
    expect(error).not.toBeNull();
  });
});

describe("members", () => {
  it("can see the team list", async () => {
    const { data, error } = await member.client.from("profiles").select("id").in("id", [member.id, boss.id]);
    expect(error).toBeNull();
    expect(data).toHaveLength(2);
  });

  it("can change their own name", async () => {
    const { error } = await member.client.from("profiles").update({ full_name: "Renamed" }).eq("id", member.id);
    expect(error).toBeNull();
    const { data } = await admin.from("profiles").select("full_name").eq("id", member.id).single();
    expect(data?.full_name).toBe("Renamed");
  });

  it("cannot make themselves admin by editing the table", async () => {
    const { error } = await member.client.from("profiles").update({ role: "admin" }).eq("id", member.id);
    expect(error).not.toBeNull();
    const { data } = await admin.from("profiles").select("role").eq("id", member.id).single();
    expect(data?.role).toBe("member");
  });

  it("cannot make themselves admin through the role function", async () => {
    const { error } = await member.client.rpc("set_user_role", {
      target_user_id: member.id,
      new_role: "admin",
    });
    expect(error).not.toBeNull();
    const { data } = await admin.from("profiles").select("role").eq("id", member.id).single();
    expect(data?.role).toBe("member");
  });

  it("cannot demote an admin", async () => {
    const { error } = await member.client.rpc("set_user_role", {
      target_user_id: boss.id,
      new_role: "member",
    });
    expect(error).not.toBeNull();
  });

  it("cannot edit someone else's profile", async () => {
    await member.client.from("profiles").update({ full_name: "Hacked" }).eq("id", boss.id);
    const { data } = await admin.from("profiles").select("full_name").eq("id", boss.id).single();
    expect(data?.full_name).toBe("Test admin");
  });

  it("cannot create or delete profiles", async () => {
    const ins = await member.client
      .from("profiles")
      .insert({ id: crypto.randomUUID(), email: "x@example.com" });
    expect(ins.error).not.toBeNull();

    await member.client.from("profiles").delete().eq("id", boss.id);
    const { data } = await admin.from("profiles").select("id").eq("id", boss.id);
    expect(data).toHaveLength(1);
  });

  it("are not admins", async () => {
    const { data } = await member.client.rpc("is_admin");
    expect(data).toBe(false);
  });
});

describe("admins", () => {
  it("are recognised as admins", async () => {
    const { data } = await boss.client.rpc("is_admin");
    expect(data).toBe(true);
  });

  it("can promote and demote other people", async () => {
    const up = await boss.client.rpc("set_user_role", { target_user_id: member.id, new_role: "admin" });
    expect(up.error).toBeNull();
    let { data } = await admin.from("profiles").select("role").eq("id", member.id).single();
    expect(data?.role).toBe("admin");

    const down = await boss.client.rpc("set_user_role", { target_user_id: member.id, new_role: "member" });
    expect(down.error).toBeNull();
    ({ data } = await admin.from("profiles").select("role").eq("id", member.id).single());
    expect(data?.role).toBe("member");
  });

  it("cannot change their own role (prevents locking themselves out)", async () => {
    const { error } = await boss.client.rpc("set_user_role", { target_user_id: boss.id, new_role: "member" });
    expect(error).not.toBeNull();
  });

  it("still cannot change roles by editing the table directly", async () => {
    const { error } = await boss.client.from("profiles").update({ role: "member" }).eq("id", boss.id);
    expect(error).not.toBeNull();
  });
});
