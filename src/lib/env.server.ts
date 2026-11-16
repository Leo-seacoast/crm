import "server-only"; // Build fails if this file is ever imported by browser code.
import { z } from "zod";

export const APP_ENVS = ["development", "staging", "production"] as const;
export type AppEnv = (typeof APP_ENVS)[number];

const serverSchema = z.object({
  APP_ENV: z.enum(APP_ENVS, { message: "APP_ENV must be development, staging or production" }),
  SUPABASE_SECRET_KEY: z.string().min(1, "SUPABASE_SECRET_KEY is missing"),
});

export type ServerEnv = z.infer<typeof serverSchema>;

export function parseServerEnv(source: Record<string, string | undefined>): ServerEnv {
  const result = serverSchema.safeParse(source);
  if (!result.success) {
    const problems = result.error.issues
      .map((i) => `- ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(
      `Missing or invalid server settings. Check your .env.local file (see .env.example):\n${problems}`,
    );
  }
  return result.data;
}

export function getServerEnv(): ServerEnv {
  return parseServerEnv(process.env);
}

/** True only in production. Used later to enforce "owner-only" messaging everywhere else. */
export function isProduction(): boolean {
  return getServerEnv().APP_ENV === "production";
}
