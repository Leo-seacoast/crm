"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loginSchema } from "@/lib/auth/schemas";
import { safeNextPath } from "@/lib/auth/paths";

export type LoginState = { error?: string; email?: string };

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next") ?? undefined,
  });

  const typedEmail = typeof formData.get("email") === "string" ? String(formData.get("email")) : "";

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check your details", email: typedEmail };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    // Same message whether the email or the password was wrong, so the form
    // can't be used to discover which emails have accounts.
    const tooMany = error.status === 429;
    return {
      error: tooMany
        ? "Too many attempts. Please wait a few minutes and try again."
        : "Email or password is incorrect.",
      email: parsed.data.email,
    };
  }

  redirect(safeNextPath(parsed.data.next));
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
