# CRM

Our own CRM, replacing GoHighLevel. See `CLAUDE.md` for the rules and roadmap.

## Run it on your computer

```bash
npm install
npm run dev
```

Then open http://localhost:3000

> **Windows note:** if PowerShell says "running scripts is disabled on this system",
> type `npm.cmd` instead of `npm` (and `npx.cmd` instead of `npx`), e.g. `npm.cmd run dev`.

## Settings and secrets

- `.env.example` is a blank template (safe to commit).
- `.env.local` holds the real values for your computer. It is ignored by Git and must never be shared.

## Checks

| Command             | What it does                                  |
| ------------------- | --------------------------------------------- |
| `npm test`          | Runs the automated tests                      |
| `npm run typecheck` | Checks the code for type mistakes             |
| `npm run lint`      | Checks the code for common problems           |
| `npm run build`     | Builds the app the same way the live site will |

## Database changes

All database changes are migration files in `supabase/migrations/`. Never edit the database by hand.
