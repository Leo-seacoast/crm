import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type CurrentUser = {
  id: string;
  email: string;
  fullName: string | null;
  role: "admin" | "member";
};

/**
 * Returns the logged-in person, or sends them to /login.
 * Double-checks with Supabase on every page load (doesn't just trust the cookie),
 * and refuses archived (deactivated) accounts.
 */
export async function requireUser(): Promise<CurrentUser> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, archived_at")
    .eq("id", user.id)
    .single();

  if (!profile || profile.archived_at) {
    await supabase.auth.signOut();
    redirect("/login?error=inactive");
  }

  return {
    id: profile.id,
    email: profile.email,
    fullName: profile.full_name,
    role: profile.role,
  };
}
