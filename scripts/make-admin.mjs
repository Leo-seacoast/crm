// One-time setup command: make an existing account an admin.
//
// Usage:   npm.cmd run make-admin -- you@example.com
//
// Only needed for the very first admin. After that, admins change roles inside the app.
// Uses the secret key, so it only runs on a trusted computer with .env.local set up.

import { createClient } from "@supabase/supabase-js";

const email = (process.argv[2] ?? "").trim().toLowerCase();
if (!email || !email.includes("@")) {
  console.error("Usage: npm.cmd run make-admin -- you@example.com");
  process.exit(1);
}

const { NEXT_PUBLIC_SUPABASE_URL: url, SUPABASE_SECRET_KEY: key, APP_ENV: appEnv } = process.env;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: profile, error: findError } = await supabase
  .from("profiles")
  .select("id, email, role")
  .eq("email", email)
  .maybeSingle();

if (findError) {
  console.error("Could not look up the account:", findError.message);
  process.exit(1);
}
if (!profile) {
  console.error(
    `No account found for ${email}. First add it in Supabase: Authentication -> Users -> Add user.`,
  );
  process.exit(1);
}
if (profile.role === "admin") {
  console.log(`${email} is already an admin. Nothing changed.`);
  process.exit(0);
}

const { error: updateError } = await supabase
  .from("profiles")
  .update({ role: "admin" })
  .eq("id", profile.id);

if (updateError) {
  console.error("Could not update the role:", updateError.message);
  process.exit(1);
}

console.log(`Done: ${email} is now an admin (environment: ${appEnv ?? "unknown"}).`);
