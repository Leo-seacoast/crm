import type { ErrorEvent, EventHint } from "@sentry/nextjs";

/**
 * Shared Sentry settings for the browser, the server and the edge.
 *
 * PRIVACY: Sentry only receives the technical error. We never send names,
 * emails, phone numbers, form contents, cookies or login tokens.
 * Sentry is switched OFF unless a DSN (Sentry's "address") is configured,
 * so nothing is ever sent from a developer's computer.
 */
export function sentryOptions(dsn: string | undefined, environment: string | undefined) {
  return {
    dsn,
    enabled: Boolean(dsn),
    environment: environment || "development",
    // Errors only for now (no performance tracing, no screen recording).
    tracesSampleRate: 0,
    sendDefaultPii: false,
    beforeSend: scrubEvent,
    beforeBreadcrumb: (crumb: { category?: string; data?: Record<string, unknown> }) => {
      // Breadcrumbs from inputs/console could contain typed personal data.
      if (crumb.category === "ui.input" || crumb.category === "console") return null;
      if (crumb.data) {
        delete crumb.data.body;
        delete crumb.data.request_body;
      }
      return crumb;
    },
  };
}

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE = /\+?\d[\d\s().-]{7,}\d/g;

/** Removes personal data from an error report before it leaves our app. */
export function scrubEvent(event: ErrorEvent, hint?: EventHint): ErrorEvent | null {
  void hint; // part of Sentry's signature; not needed here
  delete event.user;
  if (event.request) {
    delete event.request.cookies;
    delete event.request.data;
    delete event.request.query_string;
    if (event.request.headers) {
      for (const h of Object.keys(event.request.headers)) {
        if (/cookie|authorization|apikey|x-supabase/i.test(h)) delete event.request.headers[h];
      }
    }
    if (event.request.url) event.request.url = event.request.url.split("?")[0];
  }
  // Mask anything that looks like an email or phone number in error messages.
  const mask = (s: string) => s.replace(EMAIL, "[email]").replace(PHONE, "[phone]");
  if (event.message) event.message = mask(event.message);
  for (const ex of event.exception?.values ?? []) {
    if (ex.value) ex.value = mask(ex.value);
  }
  return event;
}
