# CLAUDE.md — CRM Project

## About this project
A custom, fully owned, **guest-facing** CRM that replaces GoHighLevel (GHL) and is
the **central database of guests, leads and members**. Scope (changed 2026-11-16):
- MTR (mid-term rental) leads: capture, pipeline, follow-up tasks
- The membership program (member records; membership itself will later move into Kismet)
- Internal reminders and alerts for our team (not marketing to guests)
- Marketing reporting: a full-funnel dashboard across our marketing (later phase)

Out of scope: property owners, owner onboarding, vendors/partners, and marketing
emails/SMS to guests (Kismet handles guest marketing).

Contact types: lead, guest, member (a contact can have several). It starts with a
single user (the owner, who is the marketing manager) and will later be used by a
small team. Owning our data and avoiding lock-in to any vendor is a core goal.

## Our other tools (how the CRM fits in)
- **Kismet** — booking engine and guest email marketing (onboarding Nov 2026);
  membership features will move into Kismet in ~1–2 months. The CRM shares
  contacts and consent with Kismet (integration phase).
- **Guesty** — property management system (reservations). Stays the system for bookings.
- **CraftedStays** — hosts our website.
- **Studio82** — agency for SEO, AEO, paid ads, and Google Analytics (monthly reports).
- **Stripe** — membership payments (currently via GHL). Our own Stripe automation is
  ON HOLD because membership moves to Kismet.
- **GHL** — current CRM; the MTR form currently lives in GHL. Stays active until each
  replacement has proven itself in production.

## About me (the owner)
I am NOT a developer. Please:
- Explain plans and changes in plain English, without jargon. If you must use a
  technical term, define it in one sentence.
- Before writing code for any feature, present a short plan and wait for my approval.
- Ask me before any major decision (new service, new library, database changes,
  anything that costs money).
- After each feature, tell me exactly how to test it myself in the browser.
- If I ask for something risky or that conflicts with these rules, tell me why and
  suggest a safer alternative instead of just doing it.

## Tech stack (do not change without asking)
- Framework: Next.js (TypeScript)
- Hosting: Vercel during development. Before going live, decide between Vercel Pro
  or a host whose free tier allows commercial use (Cloudflare or Netlify). Ask me.
- Database + login: Supabase (Postgres, Supabase Auth). Upgrade to Pro (daily
  backups) BEFORE any real customer data is added.
- Background jobs / scheduling: Inngest (agreed 2026-11-16, instead of Trigger.dev)
- Email sending: Resend (internal emails to our team)
- SMS: not planned (guest messaging is handled by Kismet); ask me first if needed
- Error monitoring: Sentry
- Code storage: GitHub
Prefer well-known, widely used libraries. Do not add a new dependency without
explaining what it does and why it's needed.

## Ownership and no lock-in
- All data lives in our own Postgres database.
- Every main table (contacts, companies, deals, tasks, messages) must be
  exportable to CSV from inside the app.
- Keep vendor-specific code (email provider, SMS provider, job runner) behind a
  small wrapper, so a provider can be swapped without rewriting the app.

## Data model rules
- One `contacts` table. A contact can have MULTIPLE types
  (lead, guest, member). Do NOT create separate tables per contact type.
- `companies` is its own table, linked to contacts (e.g. staffing agencies or
  employers that send MTR guests).
- Pipelines: `pipelines` -> `pipeline_stages` -> `deals`. A deal links to a
  contact and/or company. Active pipelines: MTR Pipeline, Membership Program.
- Every record has: `id`, `created_at`, `updated_at`, `created_by`, `owner_id`.
- Keep an `activity_log` table recording every create/update/delete and every
  automated action (who or what did it, when, and what changed).
- Prefer "soft delete" (an `archived_at` field) over permanently deleting records.
- Store each contact's email and SMS consent status, with when and how it was given.
- All database changes go through migration files, never manual edits.

## Team-ready from day one
- Login is required for everything, even while I'm the only user.
- Roles: `admin` and `member` exist from the start.
- Row-level security (RLS) is ON for every table, with policies written and
  tested at the time the table is created. Never disable RLS to "make it work."

## Security rules (non-negotiable)
- Never put secrets (API keys, passwords, tokens) in code or committed files.
  Use environment variables. Keep `.env*` files in `.gitignore`.
- Never use production credentials or production data during development.
- The Supabase service-role key is only used in server-side code, never in
  anything that runs in the browser.
- Validate all input on the server. Treat anything from outside (forms, emails,
  SMS replies, imported files, webhooks) as untrusted.
- Use parameterized queries / the Supabase client — never build SQL by joining strings.
- Verify signatures on all incoming webhooks.
- At the end of each feature, do a short security review and report any concerns to me.

## Public forms and landing pages
- Public pages and forms are the only parts of the app usable without login.
  They can ONLY create new leads; they can never read or change existing data.
- Every form has spam protection (e.g. Cloudflare Turnstile plus a hidden
  honeypot field) and rate limiting.
- Forms that lead to marketing messages include a clear, unticked consent
  checkbox, and the consent is stored on the contact.
- Duplicate submissions from the same email/phone update the existing contact
  instead of creating a duplicate.

## Messaging rules (email and SMS)
- In development and staging, ALL outgoing email and SMS go to the owner only,
  never to real contacts. Enforce this in code, not just by convention.
- New automations start in "approve before sending" mode: they create drafts in
  a queue that I approve. Only switch a template to auto-send when I explicitly say so.
- Never message a contact without the right consent for that channel.
- Every send is idempotent: the same message can never be sent twice to the same
  contact (use a unique key per message).
- Enforce daily sending caps and quiet hours (no automated messages overnight in
  the contact's time zone, or the org's time zone if unknown).
- Email: marketing-type emails include an unsubscribe link; unsubscribes are
  honored automatically and permanently.
- SMS: replies like STOP / UNSUBSCRIBE opt the contact out immediately and
  permanently; HELP gets an automatic reply. Before SMS goes live, remind me
  about carrier registration requirements (e.g. 10DLC in the US).
- Every background job must be safe to retry and must log its result to `activity_log`.
- Any automation that could loop or run repeatedly needs a hard limit.

## Environments
- `development` (local, fake data), `staging` (fake data, real infrastructure),
  `production` (real data).
- Never deploy to production directly. Changes go through GitHub, pass tests,
  then deploy.
- Never run destructive commands (dropping tables, deleting data, resetting the
  database) against production. Ask me before running them anywhere else.

## How we work
1. Plan in plain English -> I approve.
2. Build in small steps.
3. Write automated tests for each feature (especially permissions, public forms,
   messaging, and anything that deletes or sends).
4. Run the tests; fix failures before moving on.
5. Tell me how to test it manually.
6. Commit to git with a clear message once it works.
7. Short security review of what was built.

## Roadmap (revised 2026-11-16 for the guest-facing scope)
Phase 1 — Foundation (done): login, roles, contacts, companies, pipelines and deals,
  notes, activity log, RLS, CSV export, dev/staging environments, Sentry.
Phase 2 — GHL import (done): contacts/companies from GHL CSV with preview, duplicate
  check and undo; GHL pipelines recreated.
Phase 3 — Follow-up reminders: tasks with due dates (done), business settings,
  daily summary email to me.
Phase 4 — MTR form into the CRM: first by forwarding GHL form submissions to the
  CRM, later optionally a CRM-hosted form; capture lead source / UTM tags on every
  lead for reporting; all public-form safeguards above.
Phase 5 — Reporting v1: full-funnel marketing dashboard from CRM data (leads by
  source, pipeline conversion, members), then outside sources.
Phase 6 — Kismet and data sources: share contacts/consent with Kismet; bring in
  marketing data (Google Analytics and ads via Studio82 access, Kismet stats);
  later membership/payment status from Kismet. Zapier, Slack, Notion as needed.
Phase 7 — Internal automations: alerts and reminders to our team (e.g. new MTR lead,
  payment failed, renewals due), automatic tasks. Messaging rules above still apply.
Phase 8 — Team: invites, roles in the UI, assigning leads/members/tasks, deactivate
  (never delete) people who leave.
On hold — Own Stripe/membership automation (membership moving to Kismet); SMS.
Later — AI features.

GHL stays active until the replacement for each feature has been running
reliably in production. Do not suggest cancelling GHL features early.

**Current phase: 3.** (Phase 1 completed 2026-11-16 — development and staging are live;
production is not set up yet, see `docs/production-checklist.md`.
Phase 2 completed 2026-11-16 — GHL contact/company import with preview, duplicate check
and undo; GHL pipelines recreated as migrations. Opportunities not imported (GHL only had
test cards). Notes not imported: they stay in GHL for now.)
Do not start work from a later phase unless I ask.
Update this line when a phase is complete.
