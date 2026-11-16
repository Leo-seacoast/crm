import { randomBytes, randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

export type Client = SupabaseClient<Database>;

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is missing from .env.local`);
  return value;
}

export function assertNotProduction() {
  if (process.env.APP_ENV === "production") {
    throw new Error("Refusing to run database tests against production.");
  }
}

const noSession = { auth: { persistSession: false, autoRefreshToken: false } };

/** Full-access client used ONLY to set up and clean up test accounts. */
export function adminClient(): Client {
  return createClient<Database>(env("NEXT_PUBLIC_SUPABASE_URL"), env("SUPABASE_SECRET_KEY"), noSession);
}

/** A visitor who is not logged in. */
export function anonClient(): Client {
  return createClient<Database>(
    env("NEXT_PUBLIC_SUPABASE_URL"),
    env("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
    noSession,
  );
}

export type TestUser = { id: string; email: string; client: Client };

/** Creates a throwaway account and returns a client logged in as it. */
export async function createTestUser(admin: Client, label: string): Promise<TestUser> {
  const email = `crm-test-${label}-${randomUUID().slice(0, 8)}@example.com`;
  const password = randomBytes(24).toString("base64url");

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: `Test ${label}` },
  });
  if (error || !data.user) throw new Error(`Could not create test user: ${error?.message}`);

  const client = anonClient();
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw new Error(`Test user could not log in: ${signInError.message}`);

  return { id: data.user.id, email, client };
}

export async function deleteTestUsers(admin: Client, users: (TestUser | undefined)[]) {
  for (const u of users) {
    if (u) await admin.auth.admin.deleteUser(u.id);
  }
}
