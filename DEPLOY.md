# Deploying Urban Mine

Three pieces: **Supabase** (Postgres database), a **Node host** for the Fastify API (Render shown, Railway or Fly work the same), and **Vercel** for the web app (PWA).

```
Phone / browser ──▶ Vercel (web/dist, PWA) ──fetch VITE_API_URL──▶ API host (Fastify) ──▶ Supabase Postgres
```

ALL DATA IS SAMPLE. Payments, KYC and identity are simulated. Do not put real people's data in this deployment.

## 1. Supabase

1. supabase.com → New project. Pick the **Mumbai (ap-south-1)** region and a strong database password (save it in a password manager).
2. Project → **Connect** → *Transaction pooler* → copy the connection string (host ends `.pooler.supabase.com`, port **6543**). Replace `[YOUR-PASSWORD]` with the real password. If the password has special characters (`@ : / ? # %`), URL-encode them.
3. Put it in `server/.env` (this file is git-ignored; never paste it into chat or commit it):
   ```
   DATABASE_URL=postgresql://postgres.xxxx:PASSWORD@aws-0-ap-south-1.pooler.supabase.com:6543/postgres
   CORS_ORIGIN=http://localhost:5173
   ```
4. Check the connection and create the tables:
   ```
   npm run db:check
   ```
   It connects, applies `server/migrations/*.sql`, writes inside a transaction that is rolled back, and confirms Row Level Security is on for every table.
5. Load the SAMPLE data once, on an empty database only:
   ```
   SEED_DEMO=1 npm run dev:server     (PowerShell: $env:SEED_DEMO=1; npm run dev:server)
   ```
6. Why this is safe: every table has Row Level Security **on with no policies**, so Supabase's public `anon` key cannot read or write anything. Only the API server connects, with the database password. Keep the password and `DATABASE_URL` server-side only. The web app never gets them.

Optional hardening: download the CA certificate (Project → Database → SSL) and set `DATABASE_CA=path/to/prod-ca-2021.crt` so the server verifies the database's TLS certificate.

Schema changes: add a new numbered file `server/migrations/0002_*.sql`. It is applied automatically on the next start. Never edit an applied migration.

## 1b. Sign-in: phone or email, with a password (no codes, free)

People create an account with their mobile number OR their email, plus a password. No SMS or email code is sent, so it costs nothing and needs no SMS provider or DLT registration.

In Supabase:
1. **Authentication → Providers → Email**: enabled. Turn **Confirm email** OFF.
2. **Authentication → Providers → Phone**: enabled. Turn **Confirm phone** (phone confirmations) OFF. You do not need to set up an SMS provider.
3. **Authentication → Rate limits**: keep the defaults.
4. **Settings → API**: copy the Project URL and the anon / publishable key into `SUPABASE_URL` and `SUPABASE_ANON_KEY` (server and Render).
5. Create your auditor account (auditors cannot sign themselves up), then create a login with the same email or number in the app:
   ```
   npm run auditor -- you@example.com "Your Name"
   ```

Note: without confirmation, anyone could type someone else's email or number. This is fine for a demo; for real use, switch confirmation back on.

## 1c. Photo storage (private Supabase bucket)

Photos are never public. The API stores them in a **private** bucket under the SHA-256 of their bytes, and hands the app a short-lived signed link (10 minutes) only if that person may see the photo: the uploader, an auditor, or (for lots on sale or sold) an approved recycler. The old public `/uploads` address no longer exists.

1. Settings → API: copy the **service_role** (or *secret*) key into `server/.env` as `SUPABASE_SERVICE_ROLE_KEY`, and into the API host's environment. **Server only.** It bypasses every database rule: never put it in the web app, Vercel or git.
2. Create the bucket (private, 6 MB per file, jpeg/png/webp only):
   ```
   npm run storage:setup
   ```
3. Check it end to end. This uploads a tiny test picture, fetches it through a signed link, confirms the public address is refused, and deletes it:
   ```
   npm run storage:check
   ```
4. Restart the API. The start-up line should say `Photos: private Supabase Storage bucket`. Without the key it says `Photos: local disk`, which is fine for local work but is wiped on most hosts at every deploy.
5. The sample photos for the demo lots are uploaded when the sample data is seeded. If your database was seeded before this change, run the seed again on purpose (`CONFIRM_RESET=yes npm run seed`, which wipes the database) or just let those lots show the "No image (demo)" placeholder.

Photos taken in the app are re-encoded in the browser before upload, which removes camera GPS data. The server also checks the real file signature, so a non-image renamed to `.jpg` is refused. "Delete my data" removes your photos from the bucket unless someone else uploaded identical bytes.

## 1d. Photo check and fair price (optional)

A worker who agrees can have photos of a device graded **A to D** by a Claude vision model. The grade scales the estimated price **range** (A ×1.0, B ×0.9, C ×0.75, D ×0.55: SAMPLE factors in `server/src/condition.ts`, never the material values). The worker can always change the grade; their correction is logged for future training. Every offer then shows whether it is below, within or above the fair range for that lot, and a possible swollen battery shows a warning.

1. Create an API key at console.anthropic.com and put it in `server/.env` and the API host's environment as `ANTHROPIC_API_KEY`. **Server only.** Without it the app says the photo check is not available, leaves prices alone, and lets the worker choose a grade by hand.
2. Optional: `VISION_MODEL` (default `claude-sonnet-5-5`; `claude-haiku-5-5` is cheaper) and `VISION_DAILY_LIMIT` (checks per person per day, default 20). The limit caps your spend: check Anthropic's current pricing before you share the link widely.
3. **Privacy.** Nothing is sent until the worker taps Allow in the app, and they can withdraw in Profile. At most 3 downscaled photos per check are sent to Anthropic's API under its terms. The answer is stored per photo set, so the same photos are never sent twice. The grade is saved inside the lot record, so the hash chain protects it. Tell users in your own notice that photos are processed by Anthropic.
4. Every grade is an AI estimate from photos, not an appraisal. The fair range is built from SAMPLE rates and is a guide, not a promise.

## 0. Simplest: one Render service for everything

The server can serve the built web app itself, so a single Render web service gives you one address for the app and the API. There is nothing to set up on Vercel and no CORS to configure.

- Build command: `npm install` (on Render this also builds the web app: `scripts/render-build.mjs` runs only there). Start command: `npm start`.
- Environment variables: `NODE_VERSION`, `NODE_ENV=production`, `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`. The web build reuses `SUPABASE_URL` and `SUPABASE_ANON_KEY`, so you do not add the `VITE_` ones.
- Open the service's `.onrender.com` address on your phone. Sections 2 and 3 below describe the split setup (API on Render, web app on Vercel or a Render Static Site) if you prefer it.

## 2. API host (Render example)

Shortcut: the repo has a `render.yaml` Blueprint. In Render choose **New → Blueprint**, pick the repo, and fill in the values it asks for (`DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `CORS_ORIGIN`, and optionally the two secret keys). It sets the Node version, build and start commands, and health check for you. The manual steps below do the same thing.

1. New → **Web Service** → connect the GitHub repo. Root directory: repo root.
2. Runtime **Node**. Environment variable `NODE_VERSION=22` (the server needs Node 22.18+).
3. Build command: `npm install --omit=dev`  Start command: `npm start`
4. Environment variables: `DATABASE_URL` (the same pooler string), `CORS_ORIGIN` (your Vercel URL, e.g. `https://urban-mine.vercel.app`, no trailing slash). Do **not** set `SEED_DEMO` after the first load.
5. Open `https://<your-api>.onrender.com/api/health`: it should return `{"ok":true}`.

Known limits of this host setup (for the demo):
- Free instances sleep when idle, so the first request after a pause can take 30–60 s. Open the app a minute before presenting, or use a paid instance.
- Set `SUPABASE_SERVICE_ROLE_KEY` (section 1c) so photos go to Supabase Storage. Without it they sit on the host's disk, which is wiped on every deploy.
- OCR (tesseract.js) needs roughly 300–400 MB of RAM. If scans fail on a 512 MB instance, upgrade it. The scan never blocks on OCR, and workers can type the label text.

## 3. Web app on Vercel

1. New Project → import the repo. **Root Directory: `web`**. Framework: Vite (auto-detected).
2. Environment variable: `VITE_API_URL=https://<your-api>.onrender.com` (no trailing slash).
3. Deploy. `web/vercel.json` already rewrites client-side routes to `index.html`.
4. Put the final Vercel URL into the API host's `CORS_ORIGIN` and redeploy the API. Requests from any other origin are refused.
5. Camera and location need HTTPS, which Vercel provides. Install the PWA from the browser menu.

## Local development

- No `DATABASE_URL` → the server uses a local PGlite database in `.data/` (no setup; the first start takes ~15 s, later ones ~2 s).
- With `server/.env` present → it uses Supabase. Delete or comment out the `DATABASE_URL` line to go back to local.
- `npm run seed` wipes and reloads the SAMPLE data. Against Supabase it refuses unless you set `CONFIRM_RESET=yes`.
- `npm test` always uses PGlite and never touches Supabase.
- Without Supabase sign-in configured, local dev uses the sample accounts (demo mode).
