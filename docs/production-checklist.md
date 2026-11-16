# Production checklist

Production = the real CRM with real customer data. Nothing here is done yet.
Work through this list (with Claude) **before** any real data goes in — at the latest,
before the Phase 2 GHL import into production.

## Decisions needed from the owner (cost money)

- [ ] **Supabase Pro** for the production database (about $25/month) — required by
      CLAUDE.md for daily backups. The free plan allows only two projects (dev and staging).
- [ ] **Hosting for production**: Vercel Pro (about $20/month per person) or a host whose
      free plan allows commercial use (Cloudflare, Netlify). Vercel's free plan is for
      non-commercial use, so it is used for staging only.
- [ ] **Domain name** for the CRM (e.g. `crm.yourbusiness.com`).

## Supabase (production project)

- [ ] Create project `crm-prod` on the Pro plan, region closest to you.
- [ ] Apply all migrations from `supabase/migrations/` (never edit the database by hand).
- [ ] Authentication: turn OFF "Allow new users to sign up"; minimum password length 12.
- [ ] Turn on leaked-password protection (available on Pro).
- [ ] Confirm daily backups are on; consider Point-in-Time Recovery.
- [ ] Create the owner's account, then run `make-admin` against production (one time).
- [ ] Never copy development or staging data into production, and never use production
      keys on a developer's computer.

## Hosting (production site)

- [ ] Environment variables: `APP_ENV=production`, `NEXT_PUBLIC_APP_ENV=production`,
      Supabase URL / publishable key / secret key (production project),
      `NEXT_PUBLIC_SENTRY_DSN`, optional `SENTRY_ORG` / `SENTRY_PROJECT` / `SENTRY_AUTH_TOKEN`.
- [ ] Production deploys only from GitHub `main` after the automatic checks pass —
      never deploy from a computer directly.
- [ ] Custom domain with HTTPS.

## Monitoring

- [ ] Sentry: alerts for the `production` environment go to the owner's email.
- [ ] Check the first production errors (if any) within a day of going live.

## Before going live

- [ ] Run `npm run test:db:staging` against staging — all tests pass.
- [ ] Short security review of the whole app.
- [ ] Keep GHL running until each feature has worked reliably in production
      (see CLAUDE.md — do not cancel GHL features early).
