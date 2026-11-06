# Development log

## Phase 0 and 2 (foundation): project structure and database models
- Created the folder layout from section 8 of the specification, adapted to Express and plain HTML/CSS/JS (`app/` became `routes/` and `public/`; `hooks/` and `types/` are not needed).
- Added all 13 Mongoose models, indexes, connection helper with serverless caching, transaction helper, append-only plugin.
- Added `GET /api/health`, a status page, dev seed script, unit tests for models and normalization.
- Acceptance (Phase 2): connection reliable, validation and indexes tested, no secrets in client code.
  - [ ] `npm run db:check` connects to your MongoDB
  - [ ] `npm run db:sync` creates all indexes
  - [ ] `npm run seed:dev` runs and prints totals
  - [ ] http://localhost:3000 shows "Database connected"

## Phase 3: authentication and authorization
- Member and administrator sign-in with email + reference number on separate pages; admins can add, disable/enable and reset other admins.
- Server-side role checks (`requireRole`) on every protected route; the member route reads the member from the session only.
- Sessions in an HttpOnly cookie, re-checked against the database each request; CSRF guard; database-backed sign-in throttling; failed sign-ins are written to the audit log (email hash only).
- Tests: 13 new unit and HTTP-level tests (database stubbed) and `tests/integration/auth.test.js` (real database, run it with `MONGODB_URI_TEST`).
- Acceptance (verify yourself):
  - [ ] `npm run admin:create` creates the first administrator
  - [ ] Admin signs in at /admin/login.html and reaches the admin page
  - [ ] Admin adds a second admin; the second admin can sign in
  - [ ] A disabled admin is signed out on the next click
  - [ ] A member (a `DEV-` member from the seed, or one you add) signs in at /auth/login.html and sees only their own details
  - [ ] A member opening /admin/index.html is sent to the admin sign-in page
  - [ ] Six wrong attempts in a row show "Too many attempts"

## Phase 4: member Excel import

- Added an admin-only member column listing endpoint, downloadable Excel template, and
  validated `.xlsx`/`.xls` upload flow.
- Imports create new members or update existing members by normalized Member ID and record
  the result in `importHistory` and `auditLogs`.

## Phase 5: categories and scoring criteria

- Added admin-only category and criterion listing, creation, and activation management.
- Criteria support automatic attendance awards, manual administrator awards, positive point
  values, and optional per-member award limits.
- Existing append-only point transaction snapshots preserve historical criterion details when
  categories or criteria are edited.

## Phase 6: activities and venues

- Added admin-only venue and activity listing, creation, and editing.
- Venues store coordinates and a configurable radius defaulting to 500 m.
- Activities support different venues, radius overrides, schedules, statuses, automatic
  attendance criteria, and attendance opening and closing windows.
- Existing model validation rejects invalid coordinates, radius values, and time windows.

## Admin dashboard navigation

- Split Administration, Members, Scoring, and Activities into separate pages.
- Added a shared left navigation sidebar on desktop and a responsive slide-out menu on
  mobile devices.

## Phase 7: QR sessions

- Added temporary QR session generation with 256-bit random tokens and hash-only storage.
- Added expiry, revocation, display, download, and print support in the admin QR sessions page.
- Added server-side validation that rejects malformed, unknown, expired, not-yet-started, and
  revoked tokens.
- QR payloads contain only an opaque attendance token and no member details.
- QR payloads use the deployed HTTPS attendance scan route, with `APP_URL` configuration for
  Vercel and request-host fallback for previews/local development.

## Phase 8: GPS attendance and automatic points

- Added the member QR landing and sign-in handoff, including browser geolocation submission.
- The server derives member identity from the authenticated member session and validates session
  status, timing, GPS coordinates, GPS accuracy, venue distance, and automatic criterion setup.
- Accepted attendance and its automatic point transaction are created together when MongoDB
  transactions are available; unique indexes and duplicate handling make retries safe.

## Phase 9: manual and bulk scoring

- Added the admin-only Awards page for individual and bulk manual awards.
- Awards require an active manual criterion, active members, a reason, and the awarding
  administrator identity from the authenticated session.
- Added linked reversal and correction transactions; the append-only ledger and audit log preserve
  every change and ledger totals remain sums of all transaction points.

## Phase 10: admin analytics dashboard

- Added a responsive Analytics page with member filters, dynamic category columns, totals,
  category/member charts, and ledger transaction counts.
- Analytics rows and summary cards are calculated from the append-only point transaction ledger;
  inactive members can be included explicitly with the status filter.
- Added admin-only filtered CSV and Excel exports using the same report data as the page.

## Phase 11: member portal

- Extended the existing member portal with a personal score summary, category totals, point
  transaction history, and attendance history.
- Added a session-scoped member portal API; the member identifier is always taken from the
  authenticated member account and cannot be supplied by the browser.

## Phase 12: leaderboard and publication controls

- Added server-enforced public leaderboard rankings with overall and category-filtered views.
- Added private, published, and scheduled visibility controls, tie handling, category filters, and
  approved public field selection.
- Public responses are projected from an allowlist and never include private contact details.

## Phase 13: reports, audit logs and settings

- Added admin-only attendance, scoring, import-history, and audit-log reports with filtered CSV
  exports.
- Added an admin Settings page for the default attendance radius, QR session expiry, and maximum
  GPS accuracy; new venues and QR sessions use the saved defaults.
- Added backup and recovery procedures in `docs/BACKUP_AND_RECOVERY.md`.

## Phase 14: security, performance and quality assurance

- Unit and HTTP tests pass; the real MongoDB integration test remains environment-skipped until
  `MONGODB_URI_TEST` is configured, and no browser/device test harness is currently configured.
- Verified role authorization, CSRF protection, login throttling, session revalidation, QR token
  validation, append-only ledgers, public-field allowlisting, report limits, and model indexes.
- Removed the hardcoded development JWT secret fallback; every environment now requires a random
  `SESSION_SECRET` of at least 32 characters.
- `xlsx` remains a known unresolved dependency audit finding: current advisories have no upstream
  fix and replacing the workbook library is deferred.
- Hardened workbook imports with one-sheet, seven-column, 5,000-row, 5 MB, and 1,000-character
  cell limits; formulas and unnecessary workbook features are not processed.
