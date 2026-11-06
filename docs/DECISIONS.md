# ClubPoint decisions

## Decided

| # | Decision | Notes |
|---|----------|-------|
| 1 | Stack: Node.js + Express, MongoDB with Mongoose, plain HTML/CSS/JS frontend, JavaScript (CommonJS) | The spec recommends Next.js + TypeScript but says the stack is a recommendation. This keeps the Express/Mongo stack chosen at the start. Revisit before Phase 1 if you want Next.js. |
| 2 | Collection names match the spec (`pointTransactions`, `attendanceSessions`, ...) | Set explicitly on each schema. |
| 3 | Member ID normalization: remove all whitespace, uppercase | `ab 12` and `AB12` are the same member. Original is kept in `memberId`. |
| 4 | Name comparison: ignore case, accents, `. , '` and extra spaces | Used for attendance identity checks. Never used alone to merge members. |
| 5 | One unique `accepted` attendance record per member and session (partial unique index); rejected attempts are stored too | Lets a member retry after an out-of-range attempt while preventing double points. |
| 6 | One attendance record can earn points once (unique `attendanceRecord` on transactions); a transaction can be reversed once (unique `reversalOf`) | |
| 7 | `pointTransactions` and `auditLogs` are append-only in Mongoose | Totals come from the ledger via `PointTransaction.totalsByMember/totalsByCategory`. |
| 8 | Session expiry is computed from `expiresAt`; status only stores `active` or `revoked` | |
| 9 | Transactions are used when MongoDB supports them (Atlas does; plain local mongod does not) | See `lib/db/withTransaction.js`. |
| 10 | Sign-in method: email + reference number for members and administrators, on two separate pages (`/auth/login.html`, `/admin/login.html`) | Chosen by the club. Members are checked against the members collection (the Excel data), where the reference number is the Member ID. Administrators have an account with the reference stored as a salted scrypt hash. |
| 11 | Administrators are created by the first admin (`npm run admin:create`) and then by any admin from the admin page; no public admin sign-up | An admin cannot disable themselves. Disabling takes effect on the next request. |
| 12 | Member accounts are created automatically on first sign-in; an administrator can still disable a member account, and deactivating a member blocks sign-in | Members whose email or reference is missing from the Excel data cannot sign in. |
| 13 | Sessions: signed token in an HttpOnly, SameSite=Lax cookie (Secure in production), 8 hours by default (`SESSION_HOURS`) | The user is re-loaded from the database on every request. |
| 14 | Brute-force protection stored in MongoDB (`loginThrottles`, auto-expiring): 5 failures per person and IP, 30 per email, 30 per IP, in 15 minutes | Works on Vercel, where in-memory counters do not. Stores hashes only. |
| 15 | CSRF protection: writes must be JSON and, if an Origin header is sent, it must match the site | `middleware/csrfGuard.js` |

### Known limitation of the chosen sign-in method

An email and a reference number are not secret in the way a password is: anyone who knows both can sign in as that member. The spec warns about this. The risk is reduced because a member session can only read that member's own record (and later, submit attendance, which also needs the live QR code and GPS check), and sign-in attempts are rate-limited. If the club later wants stronger protection, add a one-time code sent to the member's email or a personal PIN. Administrators have much more power, so give them long, private reference numbers (the form accepts 6 to 64 characters).

## Defaults (confirmed)

| Setting | Value | Where |
|---------|-------|-------|
| Radius limits per venue/activity | 10 to 5000 m (default 500 m from the spec) | `models/Venue.js` |
| QR session expiry | 3 hours (180 minutes) | `models/SystemSetting.js` |
| Maximum GPS accuracy accepted | 100 m | `models/SystemSetting.js` |
| Leaderboard default | private; public fields: name, department, total points | `models/PublicationSetting.js` |
| Tie handling | competition ranking (1, 2, 2, 4) | `models/PublicationSetting.js` |

## Still to decide (spec section 17)

- Attendance session opening and closing times (Phase 7).
- Whether attendance points vary by activity or are fixed per criterion (Phase 5).
- Leaderboard ranking: overall only, or also by category and department.
- Profile images: Google Drive URLs or a managed image service.
- Retention period for attendance location data and the privacy notice wording.

## Phase 4 Excel member contract

The member workbook uses these headings: `Member ID` (required), `Full Name` (required),
`Department`, `Email`, `Phone`, `Profile Image URL`, and `Status`. Status defaults to
`active` and may be `active` or `inactive`. Member IDs are normalized using the existing
policy; uploading an existing ID updates that member, while a new ID creates a member.

## Phase 5 scoring contract

Categories are ordered, can be activated or deactivated, and have case-insensitive unique names.
Criteria belong to a category and support positive point values, `automatic` or `manual` award
methods, active status, and an optional per-member award limit. Point transactions store the
criterion and category names, point value, and award method in an append-only historical snapshot;
editing a category or criterion therefore cannot rewrite historical awards.

## Phase 6 activities and venues contract

Venues use latitude and longitude coordinates with a default attendance radius of 500 m.
Configurable radii are restricted to 10-5000 m. Activities may override the venue radius,
choose an automatic attendance criterion, and define start/end and attendance opening/closing
times. Model validation rejects invalid coordinates, radius values, and reversed time windows.

## Phase 7 QR session contract

QR sessions use 32 random bytes encoded as a URL-safe token. Only the SHA-256 token hash is
stored in MongoDB. The QR payload is an HTTPS `/attendance/scan.html?token=...` URL with no
member or account details. Sessions default to 180 minutes, can be revoked by an administrator,
and are usable only when active, started, and before expiry. Vercel sets `APP_URL` to the
production domain; preview/local requests use their current host when the setting is absent.

## Phase 8 attendance contract

Attendance submission is member-authenticated; member IDs are never accepted from the browser.
The server checks the QR session, activity window, GPS accuracy (default maximum 100 m), and
Haversine distance to the configured venue radius. Rejected attempts are retained for audit,
while the partial unique member/session index permits only one accepted attempt. Accepted
attendance and its automatic point transaction are created in one MongoDB transaction when
supported, with duplicate-key recovery for safe retries.

## Phase 9 scoring contract

Only authenticated administrators can issue manual or bulk awards. Awards use active manual
criteria and require a reason. Bulk awards are capped at 500 active members per request and
respect criterion award limits. Reversals create negative linked transactions, while corrections
create non-zero linked adjustment transactions; neither edits nor deletes the original ledger
entry. Totals are reconciled by aggregating the append-only transaction ledger.

## Phase 10 analytics contract

The admin analytics report filters members by name/ID, department, status, category, and
transaction date range. Category columns are generated from configured categories and all
transaction points, including reversals and corrections, are summed from the ledger. CSV and
Excel downloads call the same authorized report endpoint and therefore preserve the active
filters and permissions.

## Phase 11 member portal contract

The member portal exposes profile, score, point transaction, and attendance data only for the
member linked to the authenticated session. The portal endpoint accepts no member identifier;
ownership is derived server-side from `req.user.member._id`. History is read-only and limited to
the most recent 200 point transactions and attendance records.

## Phase 14 security limitations

Session authentication fails closed when `SESSION_SECRET` is missing or shorter than 32
characters, regardless of environment. The current `xlsx` dependency has known prototype
pollution and ReDoS advisories with no available upstream fix; workbook uploads remain an
accepted operational risk until the library is replaced and the import/export paths are migrated.
As a compensating control, member imports accept only one worksheet with the supported seven
columns, at most 5,000 rows and 5 MB, reject oversized cell values, and disable formula/metadata
processing. Excel exports are generated write-only from server-calculated data.

## Phase 12 leaderboard contract

The public leaderboard endpoint returns 404 unless the singleton publication setting is currently
published or inside its scheduled window. Rankings are calculated from the append-only point
ledger, with optional category filtering and configured tie handling. Public fields are projected
from the PublicationSetting allowlist; email and phone are never accepted or returned.

## Phase 13 reports and settings contract

Reports are admin-only and limit result sets to the most recent 500 operational rows (200 import
rows). CSV exports use the same permission-protected endpoints and filters. System settings are
validated against safe bounds before persistence; saved radius and QR expiry values apply to new
venues and sessions, while explicit activity/session values remain authoritative.
