import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

const nextConfig: NextConfig = {
  // Local development only: lets the app also be opened at http://127.0.0.1:3000
  // (used for testing with a second login). Has no effect on the live site.
  allowedDevOrigins: ["127.0.0.1"],
};

export default withSentryConfig(nextConfig, {
  // Readable error locations in Sentry. Only used when these are set on the
  // hosting service (Vercel); otherwise skipped quietly.
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  sourcemaps: {
    disable: !process.env.SENTRY_AUTH_TOKEN,
    // Don't leave source maps publicly downloadable after uploading them to Sentry.
    deleteSourcemapsAfterUpload: true,
  },
  silent: !process.env.CI,
  telemetry: false, // don't send Sentry usage statistics about our builds
});
