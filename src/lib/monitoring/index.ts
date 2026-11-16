import * as Sentry from "@sentry/nextjs";

/**
 * Our own small wrapper around the error-monitoring service (currently Sentry).
 * App code calls these functions, never Sentry directly, so the service can be
 * swapped without touching the rest of the app.
 */
export function reportError(error: unknown, context?: Record<string, string | number | boolean>) {
  Sentry.captureException(error, context ? { tags: context } : undefined);
}
