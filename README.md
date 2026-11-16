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

## Sending, scheduling and releasing training

- **Smart reminders**: "Send reminders" (People, Emails, event pages, or a multi-select) gives each person the template that fits them: not started, event coming up, expiring or expired. You can untick groups, preview each group, and send now or schedule.
- **Compose**: choose recipients from a checklist, send yourself a test, then send now or schedule (quick picks, or a set time before an event).
- **Scheduled sends** queue in `db.scheduled` and go out when due (checked when the app opens and every 30 seconds in the demo). Live version: a Cron Trigger. They're listed under Emails → Coming up, with Preview, Send now and Cancel.
- **Training release per event**: send invites as soon as people are added, a set number of weeks before the event, on a date you choose, or hold them until you release them. People can be added any time; invites and that event's reminders wait until release.
- **People multi-select**: tick rows or a whole page, or select everyone matching the filters. Then send reminders, email, add to an event, archive or reactivate.
- **Add several events**: type the events into the grid, or paste them from a spreadsheet. Training and release settings are shared across all of them.

## Syncing a full list

People → **Sync a full list…** (or **Sync team from a list…** on an event). Upload or paste the complete current list (first_name, last_name, email; roles and events are optional). It's compared with what's already here:
- new people are added
- changed details are updated (training history is never touched)
- archived people on the list are reactivated
- anyone not on the list is archived (or taken off that event's team)

Everyone else is left alone. Each group and each person can be unticked before applying. Same-name, different-email matches are flagged so you can update the email instead of creating a duplicate. A warning appears if more than 30% of the list would be archived. Every change is audit-logged, and **Undo this sync** restores everything straight after.

## Accessibility

Checked with axe-core against WCAG 2.0–2.2 A/AA on every page and the main dialogs, at desktop and phone sizes, with no violations. Built in:
- touch targets of at least 24px everywhere and 44px on touch screens
- a skip link, visible focus rings, and focus kept inside dialogs (focus returns afterwards)
- Escape closes menus and dialogs
- labelled controls, and live announcements for page changes and toasts
- an accessible video slider and an AA-contrast palette
- respect for reduced-motion and increased-contrast settings

## Pathway versions

Versions are shown as **major.minor**: 1.0, 1.1, 1.2, then 2.0. When you publish, choose:
- **Small update** (minor, e.g. 1.1): typos, clearer wording, extra or improved quiz questions.
- **Major update** (major, e.g. 2.0): new or changed content; steps added, removed or reordered; a different video.

The editor suggests one based on what changed. Records still keep a running version number underneath for reliable matching (`training_records.details.version`), plus `version_label` for display. Certificates always show the version they were earned on.
