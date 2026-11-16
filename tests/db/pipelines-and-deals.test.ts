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
const tag = randomUUID().slice(0, 8);

// Test fixtures (removed afterwards)
let pipelineId: string;
let otherPipelineId: string;
let openStage: string;
let open2Stage: string;
let wonStage: string;
let otherStage: string;
let contactId: string;
const dealIds: string[] = [];

beforeAll(async () => {
  member = await createTestUser(admin, "pd-member");
  boss = await createTestUser(admin, "pd-admin");
  await admin.from("profiles").update({ role: "admin" }).eq("id", boss.id);

  const p = await admin.from("pipelines").insert({ name: `Test pipeline ${tag}`, position: 99 }).select("id").single();
  pipelineId = p.data!.id;
  const p2 = await admin.from("pipelines").insert({ name: `Other ${tag}`, position: 100 }).select("id").single();
  otherPipelineId = p2.data!.id;

  const stages = await admin
    .from("pipeline_stages")
    .insert([
      { pipeline_id: pipelineId, name: "Open A", kind: "open", position: 1 },
      { pipeline_id: pipelineId, name: "Open B", kind: "open", position: 2 },
      { pipeline_id: pipelineId, name: "Won", kind: "won", position: 3 },
      { pipeline_id: otherPipelineId, name: "Elsewhere", kind: "open", position: 1 },
    ])
    .select("id, name");
  const byName = Object.fromEntries(stages.data!.map((s) => [s.name, s.id]));
  openStage = byName["Open A"];
  open2Stage = byName["Open B"];
  wonStage = byName["Won"];
  otherStage = byName["Elsewhere"];

  const c = await admin
    .from("contacts")
    .insert({ first_name: "Deal", last_name: `Tester ${tag}`, email: `crm-test-deal-${tag}@example.com` })
    .select("id")
    .single();
  contactId = c.data!.id;
});

afterAll(async () => {
  if (dealIds.length) await admin.from("deals").delete().in("id", dealIds);
  await admin.from("pipeline_stages").delete().in("pipeline_id", [pipelineId, otherPipelineId]);
  await admin.from("pipelines").delete().in("id", [pipelineId, otherPipelineId]);
  await admin.from("contacts").delete().eq("id", contactId);
  await deleteTestUsers(admin, [member, boss]);
});

async function newDeal(fields: Record<string, unknown> = {}, as: TestUser = member) {
  const { data, error } = await as.client
    .from("deals")
    .insert({ title: `Deal ${tag}`, pipeline_id: pipelineId, stage_id: openStage, contact_id: contactId, ...fields })
    .select("*")
    .single();
  if (data) dealIds.push(data.id);
  return { data, error };
}

describe("starting pipelines", () => {
  it("Sales and Owner onboarding exist with their stages", async () => {
    const { data } = await admin
      .from("pipelines")
      .select("name, pipeline_stages(name, kind)")
      .in("name", ["Sales", "Owner onboarding"]);
    const sales = data!.find((p) => p.name === "Sales")!;
    expect(sales.pipeline_stages.map((s) => s.name)).toEqual(
      expect.arrayContaining(["New lead", "Contacted", "Proposal sent", "Negotiation", "Won", "Lost"]),
    );
    const onboarding = data!.find((p) => p.name === "Owner onboarding")!;
    expect(onboarding.pipeline_stages.find((s) => s.name === "Live")?.kind).toBe("won");
    expect(onboarding.pipeline_stages.find((s) => s.name === "Not proceeding")?.kind).toBe("lost");
  });
});

describe("who can manage pipelines", () => {
  it("logged-out visitors see nothing", async () => {
    const { data, error } = await anonClient().from("pipelines").select("id").limit(1);
    expect(error !== null || (data ?? []).length === 0).toBe(true);
    const d = await anonClient().from("deals").select("id").limit(1);
    expect(d.error !== null || (d.data ?? []).length === 0).toBe(true);
  });

  it("members can see pipelines but not add, rename or archive them", async () => {
    const seen = await member.client.from("pipelines").select("id").eq("id", pipelineId);
    expect(seen.data).toHaveLength(1);

    const add = await member.client.from("pipelines").insert({ name: "Sneaky" });
    expect(add.error).not.toBeNull();
    const rename = await member.client.from("pipelines").update({ name: "Renamed" }).eq("id", pipelineId).select("id");
    expect(rename.data ?? []).toHaveLength(0);
    const stage = await member.client.from("pipeline_stages").insert({ pipeline_id: pipelineId, name: "X" });
    expect(stage.error).not.toBeNull();
    const kind = await member.client.from("pipeline_stages").update({ kind: "won" }).eq("id", openStage).select("id");
    expect(kind.data ?? []).toHaveLength(0);
  });

  it("admins can rename stages", async () => {
    const r = await boss.client.from("pipeline_stages").update({ name: "Open A" }).eq("id", openStage).select("id");
    expect(r.data).toHaveLength(1);
  });

  it("a stage can't be moved into another pipeline", async () => {
    const r = await boss.client.from("pipeline_stages").update({ pipeline_id: otherPipelineId }).eq("id", openStage);
    expect(r.error).not.toBeNull();
  });
});

describe("deals", () => {
  it("a member can add a deal; creator can't be faked", async () => {
    const { data, error } = await newDeal({ value: 12500.5, created_by: boss.id });
    expect(error).toBeNull();
    expect(data!.created_by).toBe(member.id);
    expect(Number(data!.value)).toBe(12500.5);
    expect(data!.currency).toBe("USD");
    expect(data!.closed_at).toBeNull();
  });

  it("must link to a contact or a company", async () => {
    const r = await newDeal({ contact_id: null });
    expect(r.error).not.toBeNull();
  });

  it("the stage must belong to the deal's pipeline", async () => {
    const r = await newDeal({ stage_id: otherStage });
    expect(r.error).not.toBeNull();
  });

  it("negative values are rejected", async () => {
    expect((await newDeal({ value: -1 })).error).not.toBeNull();
  });

  it("moving to a Won stage closes the deal; moving back reopens it", async () => {
    const { data } = await newDeal();
    const won = await member.client.from("deals").update({ stage_id: wonStage }).eq("id", data!.id).select("*").single();
    expect(won.data!.closed_at).not.toBeNull();
    const back = await member.client.from("deals").update({ stage_id: open2Stage }).eq("id", data!.id).select("*").single();
    expect(back.data!.closed_at).toBeNull();
  });

  it("the close date can't be edited by hand", async () => {
    const { data } = await newDeal();
    await member.client.from("deals").update({ closed_at: "2000-01-01T00:00:00Z" }).eq("id", data!.id);
    const { data: after } = await admin.from("deals").select("closed_at").eq("id", data!.id).single();
    expect(after!.closed_at).toBeNull();
  });

  it("stage moves are recorded in the activity log", async () => {
    const { data } = await newDeal();
    await member.client.from("deals").update({ stage_id: open2Stage }).eq("id", data!.id);
    const { data: log } = await admin
      .from("activity_log")
      .select("actor_id, changes")
      .eq("record_id", data!.id)
      .eq("action", "update")
      .single();
    expect(log!.actor_id).toBe(member.id);
    expect(log!.changes).toMatchObject({ stage_id: { old: openStage, new: open2Stage } });
  });

  it("members can archive but not restore; nobody can delete", async () => {
    const { data } = await newDeal();
    const arch = await member.client
      .from("deals")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", data!.id)
      .select("id");
    expect(arch.data).toHaveLength(1);
    const restore = await member.client.from("deals").update({ archived_at: null }).eq("id", data!.id).select("id");
    expect(restore.data ?? []).toHaveLength(0);
    await boss.client.from("deals").delete().eq("id", data!.id);
    const { data: still } = await admin.from("deals").select("id").eq("id", data!.id);
    expect(still).toHaveLength(1);
    const adminRestore = await boss.client.from("deals").update({ archived_at: null }).eq("id", data!.id).select("id");
    expect(adminRestore.data).toHaveLength(1);
  });
});

describe("archiving stages and pipelines", () => {
  it("a stage with active deals can't be archived", async () => {
    await newDeal({ stage_id: open2Stage });
    const r = await boss.client
      .from("pipeline_stages")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", open2Stage);
    expect(r.error?.message).toMatch(/Move or archive the deals/);
  });

  it("a pipeline with active deals can't be archived", async () => {
    const r = await boss.client.from("pipelines").update({ archived_at: new Date().toISOString() }).eq("id", pipelineId);
    expect(r.error?.message).toMatch(/Move or archive the deals/);
  });

  it("an empty stage can be archived, and deals can't be dropped into it", async () => {
    const empty = await admin
      .from("pipeline_stages")
      .insert({ pipeline_id: pipelineId, name: "Empty", kind: "open", position: 9 })
      .select("id")
      .single();
    const arch = await boss.client
      .from("pipeline_stages")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", empty.data!.id);
    expect(arch.error).toBeNull();

    const { data } = await newDeal();
    const move = await member.client.from("deals").update({ stage_id: empty.data!.id }).eq("id", data!.id);
    expect(move.error?.message).toMatch(/archived/);
  });
});
