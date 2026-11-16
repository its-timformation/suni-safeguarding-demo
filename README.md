# SUNI Safeguarding Training — demo

Interactive demo of a safeguarding training tool for Scripture Union Northern Ireland: video steps with skip protection, randomised quizzes, attestation, certificates with QR verification, and an admin area (people, events, pathways, follow-ups, audit log, printing).

**Demo only** — all people are fictional and data is stored in the viewer's browser (localStorage). Not for real records.

- `public/` — the deployed site (Cloudflare Pages output directory). `index.html` is fully self-contained.
- `src/` — app source (`index.html` shell, `core.js` learner + data, `admin.js` admin).
- `brand/`, `media/` — logo artwork, captions, demo video.
- `python3 build.py` — rebuilds `public/index.html`.

Deploys automatically to Cloudflare Pages on every push to `main` (build command: none, output directory: `public`).
