import * as Sentry from "@sentry/nextjs";
import { sentryOptions } from "@/lib/monitoring/sentry-options";

// Error monitoring in the browser (only if configured). No screen recording.
Sentry.init(sentryOptions(process.env.NEXT_PUBLIC_SENTRY_DSN, process.env.NEXT_PUBLIC_APP_ENV));

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
