import { getAppEnv } from "@/lib/env.server";

/** A coloured strip on every page outside production, so nobody mistakes test data for real data. */
export function EnvironmentBanner() {
  const env = getAppEnv();
  if (env === "production") return null;

  const style =
    env === "staging"
      ? "bg-amber-400 text-amber-950"
      : "bg-sky-600 text-white";
  const text = env === "staging" ? "STAGING — fake data only" : "DEVELOPMENT — your computer, fake data only";

  return (
    <div role="note" className={`px-4 py-1 text-center text-xs font-semibold tracking-wide ${style}`}>
      {text}
    </div>
  );
}
