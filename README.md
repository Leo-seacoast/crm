# CRM

Our own CRM, replacing GoHighLevel. See `CLAUDE.md` for the rules and roadmap.

## Environments

| Environment     | Where                         | Database (Supabase) | Data            |
| --------------- | ----------------------------- | ------------------- | --------------- |
| **development** | your computer (localhost)     | `crm-dev`           | fake            |
| **staging**     | Vercel (free plan)            | `crm-staging`       | fake            |
| **production**  | not set up yet — see [docs/production-checklist.md](docs/production-checklist.md) | `crm-prod` (Pro) | real |

A coloured banner at the top of every page shows which environment you're in
(none in production).

## Run it on your computer

```bash
npm install
npm run dev
```

Then open http://localhost:3000

> **Windows note:** if PowerShell says "running scripts is disabled on this system",
> type `npm.cmd` instead of `npm` (and `npx.cmd` instead of `npx`), e.g. `npm.cmd run dev`.

## Settings and secrets

- `.env.example` is a blank template (safe to commit). It explains every setting.
- `.env.local` holds the development values; `.env.staging.local` the staging values.
  Both are ignored by Git and must never be shared.
- Staging/production settings are entered in the hosting dashboard (Vercel).

## Checks

| Command                    | What it does                                            |
| -------------------------- | ------------------------------------------------------- |
| `npm test`                 | Runs the automated code tests                           |
| `npm run test:db`          | Runs the database security tests against development    |
| `npm run test:db:staging`  | Same, against staging (needs `.env.staging.local`)      |
| `npm run typecheck`        | Checks the code for type mistakes                       |
| `npm run lint`             | Checks the code for common problems                     |
| `npm run build`            | Builds the app the same way the live site will          |

GitHub runs the code tests, checks and build automatically on every change
(`.github/workflows/ci.yml`).

## Database changes

All database changes are migration files in `supabase/migrations/`. Never edit the database by hand.

| Command                 | What it does                                                   |
| ----------------------- | -------------------------------------------------------------- |
| `npm run db:push`       | Applies new migrations to the linked Supabase project           |
| `npm run db:types`      | Regenerates `src/lib/supabase/database.types.ts`               |
| `npm run make-admin -- you@example.com` | Makes an existing account an admin (development) |
| `npm run make-admin:staging -- you@example.com` | Same, on staging                       |

## Error monitoring

Sentry (via the wrapper in `src/lib/monitoring/`) reports errors from staging and
production only. It never receives names, emails, phone numbers, form contents or cookies.
