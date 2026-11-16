# SUNI Safeguarding Training — demo

Interactive demo of a safeguarding training tool for Scripture Union Northern Ireland: video steps with skip protection, randomised quizzes, attestation, certificates with QR verification, and an admin area (people, events, pathways, follow-ups, audit log, printing).

**Demo only** — all people are fictional and data is stored in the viewer's browser (localStorage). Not for real records.

- `public/` — the deployed site (Cloudflare Pages output directory). `index.html` is fully self-contained.
- `src/` — app source (`index.html` shell, `core.js` learner + data, `admin.js` admin).
- `brand/`, `media/` — logo artwork, captions, demo video.
- `python3 build.py` — rebuilds `public/index.html`.

Deploys automatically to Cloudflare Pages on every push to `main` (build command: none, output directory: `public`).

## Mock backend (volunteer lifecycle & retention)

The demo simulates a backend for up to ~3,000 volunteers with no database or email service. Everything lives in localStorage tables shaped like the production schema (`schema.sql`):

| localStorage key | D1 table |
|---|---|
| `suni-demo-v11:volunteers` | `volunteers` |
| `suni-demo-v11:training_records` | `training_records` |
| `suni-demo-v11:audit_logs` | `audit_logs` (append-only) |
| `suni-demo-v11:app` | pathways, events, settings, outbox, magic links |

**Demo sign-ins**
- Volunteers: `#/login` → enter an active volunteer's email → a simulated inbox shows a one-time link (30-minute expiry). Archived volunteers can't sign in.
- Admin: `admin@suni.demo` / `safeguarding` (demo only).

**What's simulated**
- Archive, reactivate (records over 5 years old are removed on reactivation) and permanent delete (also erases that volunteer's audit trail; only an anonymous entry is kept).
- CSV import (`first_name,last_name,email`): previews new, updated, archived (can reactivate) and invalid rows; never touches training history.
- Audit report CSV, reminders (active volunteers with incomplete training only; archived people are never emailed).
- A rolling 5-year cleanup that runs once a day when the app opens, plus "Run cleanup now" under **Data & privacy**.
- **Data & privacy → Demo tools**: load 3,000 volunteers (scale test), view raw table rows, reset demo data.

### Swapping in Cloudflare D1 and Resend

1. `wrangler d1 create suni-safeguarding` then `wrangler d1 execute suni-safeguarding --file=schema.sql`.
2. Add Pages Functions (`functions/api/*.js`) that expose the same operations as the demo: `Store.load/save` → `GET/POST /api/...`, `archiveVolunteer`, `reactivateVolunteer`, `deleteVolunteer`, `runCleanup`, import and report. The row mappers in `src/core.js` (`Rows.volunteer`, `Rows.record`, `Rows.auditRow`) already produce D1-shaped rows.
3. Magic links: `POST /api/auth/request` creates a hashed token in `magic_links` and sends it with Resend (`fetch('https://api.resend.com/emails', …)` with `RESEND_API_KEY` as a secret); `GET /auth/:token` checks it's unused, unexpired and the volunteer is active, then sets an HttpOnly session cookie.
4. Replace `sendEmails()` in `src/admin.js` with a call to an API route that sends through Resend; keep the archived filter on the server too.
5. Retention: a Cron Trigger (daily) running the SQL at the bottom of `schema.sql`.
6. Replace the demo admin login with Cloudflare Access in front of `/admin`.
