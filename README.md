# ClubPoint

Club attendance, member performance and KPI points management. Full specification: `docs/CLUBPOINT_MASTER_SPECIFICATION.docx`. Built one phase at a time; progress is in `docs/DEVELOPMENT_LOG.md`, choices in `docs/DECISIONS.md`.

## Setup
1. Node 18+ and MongoDB (local, or a free MongoDB Atlas cluster).
2. `npm install`
3. Copy `.env.example` to `.env` and set `MONGODB_URI` if you are not using the local default.
4. `npm run db:check`, then `npm run db:sync`, then `npm run seed:dev`
5. Create the first administrator:
   `npm run admin:create -- --email you@example.com --reference YOUR-REFERENCE --name "Your Name"`
6. `npm start` and open http://localhost:3000

In production set `SESSION_SECRET` (see `.env.example`). Members sign in at `/auth/login.html` with the email and reference number (Member ID) from the Excel data; administrators at `/admin/login.html`. For testing, `npm run seed:dev` creates members you can sign in as: email `dev001@clubpoint.local`, reference `DEV-001` (likewise dev002 to dev004).

## Commands
| Command | What it does |
|---------|--------------|
| `npm start` / `npm run dev` | Run the server (dev restarts on changes) |
| `npm test` | Unit tests (no database needed) |
| `npm run test:integration` | Sign-in tests against a real database. Needs `MONGODB_URI_TEST` pointing at a throwaway database whose name contains `test` |
| `npm run admin:create` | Create an administrator, or `--update` to reset their reference |
| `npm run verify:models` | Print every collection and index (no database needed) |
| `npm run db:check` | Connect and show collections and counts |
| `npm run db:sync` | Create or update indexes to match the models |
| `npm run seed:dev` | Add labelled test data (DEV- member IDs) |
| `npm run seed:reset` | Drop the whole database and seed again (development only) |

## Structure
```
clubpoint/
  server.js            Express entry point (also the Vercel entry)
  routes/              API route files (spec: app/api)
  middleware/          auth (sessions, role guards), CSRF guard, error handling
  models/              13 Mongoose models, one per collection
  services/            business logic, added per phase
  lib/
    auth/              password hashing, sessions, sign-in throttling
    permissions/ location/ imports/ scoring/   filled in by later phases
    config/            environment settings
    db/                connection, transactions, append-only plugin
    validation/        normalization helpers
  public/              frontend (spec: app, components)
    admin/ member/ attendance/ auth/   screens, one folder per area
    css/ js/components/
  scripts/             db check, model verification, dev seed
  tests/               unit/ integration/ e2e/
  docs/                specification, DEVELOPMENT_LOG.md, DECISIONS.md
```

## Collections (14)
members, users, categories, criteria, venues, activities, attendanceSessions, attendanceRecords, pointTransactions, publicationSettings, auditLogs, importHistory, systemSettings, loginThrottles.

## Deploying (Phase 15)
Use MongoDB Atlas and set `MONGODB_URI` in Vercel. Run `npm run db:sync` once against the production database to create indexes. Supabase is PostgreSQL and is not used with this Mongo code.
