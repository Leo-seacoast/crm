import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Database security tests, run with throwaway test accounts.
 *
 *   npm run test:db           -> development database (settings from .env.local)
 *   npm run test:db:staging   -> staging database     (settings ONLY from .env.staging.local)
 *
 * Each run reads exactly ONE settings file, so development and staging keys can
 * never get mixed. The settings file must say which environment it is, and these
 * tests refuse to run against production.
 */
function readEnvFile(path: string): Record<string, string> {
  if (!existsSync(path)) throw new Error(`Settings file ${path} not found (see .env.example).`);
  const out: Record<string, string> = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^"(.*)"$/, "$1");
  }
  return out;
}

export default defineConfig(({ mode }) => {
  const target = mode === "staging" ? "staging" : "development";
  const env = readEnvFile(target === "staging" ? ".env.staging.local" : ".env.local");

  if (env.APP_ENV !== target) {
    throw new Error(`Refusing to run: the settings file says APP_ENV=${env.APP_ENV}, expected ${target}.`);
  }

  return {
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
        "server-only": fileURLToPath(new URL("./tests/stubs/server-only.ts", import.meta.url)),
      },
    },
    test: {
      environment: "node",
      include: ["tests/db/**/*.test.ts"],
      env,
      testTimeout: 30_000,
      hookTimeout: 60_000,
      fileParallelism: false,
    },
  };
});
