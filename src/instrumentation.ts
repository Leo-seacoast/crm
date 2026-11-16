import * as Sentry from "@sentry/nextjs";
import { sentryOptions } from "@/lib/monitoring/sentry-options";

/** Runs once when the server starts: switches on error monitoring (only if configured). */
export async function register() {
  Sentry.init(sentryOptions(process.env.NEXT_PUBLIC_SENTRY_DSN, process.env.APP_ENV));
}

/** Reports errors that happen while the server handles a request. */
export const onRequestError = Sentry.captureRequestError;
