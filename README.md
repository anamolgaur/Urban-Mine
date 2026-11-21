# Urban Mine

A worker-first e-waste app for India's informal sector (kabadiwalas, dismantlers, repair shops). A worker scans a device, gets a fair price **range**, is guided through safe dismantling in Hindi, creates a tamper-evident lot record with photo proof, and sells to authorised recyclers who bid. Auditors review flagged lots.

Built as a hackathon prototype for *Save the Kingdom, Save the Planet* (PS01 Intelligent Waste Management, Lean In Hacks 8.0).

> **ALL DATA IS SAMPLE.** Prices, compositions, repair guides, repair counts and every person and company name are made up and labelled `SAMPLE`.
> **DRAFT CONTENT, EXPERT REVIEW REQUIRED BEFORE FIELD USE.** The safety content is not certified.

## The problem

- Informal workers do most of India's e-waste collection and dismantling but have little legal recognition under the E-Waste (Management) Rules 2022, and often lack price information, protective equipment and proof of their work.
- They face cuts, infections, lead exposure, toxic dust and battery fires. Hazard awareness is low.
- Authorised recyclers can buy from informal sellers if the purchase is documented with the seller's name and address, so a verified, auditable lot record fits an existing compliance need.
- Repair is a policy priority (Right to Repair, Repairability Index), but the informal repair economy is left out.

## What it does

| Area | Behaviour |
|---|---|
| Scan | Pick type, take up to 4 photos (top, underside, back, label). OCR reads the label and matches a 12-model table. Always shown as "Probably X, is this right?" with a confidence cap of 90%. "Wrong?" is on every guess and logs a feedback row. |
| Price | Material composition x daily rate table, shown as a **range** (+-12% for a known model, +-25% for type only), stacked composition bar, per-material weight and rupee value, change versus yesterday. |
| Photo check | Optional. With the worker's permission, photos are graded A to D by a Claude vision model (behind a `ConditionAssessor` interface). The grade scales the price range, can be changed by the worker, and a swollen battery shows a warning. Off without an API key. |
| Fair price | Each offer is tagged below, within or above the fair range for the lot (device, quantity, condition), using SAMPLE rates. A guide, not a promise. |
| Repair or recycle | If the device still works, compares repair cost, resale value and recycling value. |
| Safety | Gear checklist, then ordered steps with drawing, one instruction, DO / DON'T, a required photo for the battery step, an always-visible "Smoke, heat or fire? Call 112" line, and Hindi audio. |
| Lot record | Contents, weight, safety steps done, photo hashes, GPS, timestamp, and `hash = SHA256(prev_hash + canonical_json(record))` chained per worker. |
| Sell | Recyclers see verified lots and bid with pickup terms. The worker sees offers with a countdown and accepts one. Payout is a **simulated** UPI confirmation. |
| Receipt | PDF with seller name and address, lot id, weight, items, price and hash. Labelled "Prototype format, check against current CPCB requirements". |
| Repair centre | Fix-it-yourself guides (easy / medium / hard, tools), nearby repairers, and an "Offer your services" flow. A repair count only rises when a job has before and after photos. |
| Auditor console | Lot table, KPI strip, flagged lot detail with photo comparison and findings, Hold payout, Request re-check, editable rate table (stale rows highlighted), editable safety content. |
| Fraud flags | Rule-based: duplicate photo hash across lots, weight far from expected, GPS far from the registered workshop, low safety-step completion, rapid repeat lots. |
| Profile | Language picker (Hindi, English, Bengali, Tamil, Telugu, Marathi, Gujarati), text size (normal, large, extra large), help and emergency number, simulated identity note, **Delete my data**, demo account switcher. |
| Recycler marketplace | Searchable, filterable table of verified lots with photo evidence, seller location, a SAMPLE expected value, bid form, active offers and purchase history with receipts. |
| Repairer dashboard | Jobs with before and after photos, repair history, statistics, listing management, and a browse tab. Has its own bottom navigation. |

### What the hash chain proves

It proves a record was **not altered after it was created**. It does **not** prove the first entry was true. The UI and receipt say so.

## Design system

Editorial and quiet: warm paper, ink, hairline rules, square mono tags, one amber accent per screen. Reusable pieces live in `web/src/components/` (`ui.tsx`, `kit.tsx` for status chips, stats, meters, the progress rail, empty states and skeletons, and `Illustration.tsx` for the line drawings). Text is never below 14 px, touch targets are at least 44 px, and status is always shown with an icon or text as well as colour. The sweep that checks this (text size, touch targets, overflow) was run on every screen in English and Hindi, at the largest text size too.

## Architecture

```
 React PWA (web/, port 5173)                  Fastify API (server/, port 3000)
 ┌──────────────────────────────┐   /api/*   ┌─────────────────────────────────┐
 │ Worker app (mobile first)    │──────────▶│ routes (app.ts)                 │
 │ Recycler page                │  proxied   │  price.ts   fraud.ts   market.ts│
 │ Auditor console (desktop)    │            │  hashchain.ts  lots.ts          │
 │ i18n hi/en, speech, camera   │◀──────────│  scan.ts ─▶ Classifier (stub)   │
 └──────────────────────────────┘            │          └▶ Ocr (tesseract.js)  │
                                             │  receipt.ts (pdfkit)  repair.ts │
                                             └──────────────┬──────────────────┘
                                                            │ pg / PGlite
                                          Postgres (Supabase / PGlite) + photo bucket
```

- **Server:** Node (TypeScript run directly, no build step), Fastify. **Database:** PostgreSQL. Supabase in deployment (`pg`), PGlite (Postgres running inside Node) for local dev and tests. All SQL goes through one small async layer, `server/src/db.ts`. Schema changes are numbered files in `server/migrations/`.
- **Web:** React, Vite, TypeScript, Tailwind CSS v4, vite-plugin-pwa. Fonts: IBM Plex Sans, Sans Condensed, Mono (Noto Sans Devanagari for Hindi).
- **Interfaces to swap:** `Classifier` and `Ocr` in `server/src/vision.ts`.

## Setup

Requires Node 22.18 or newer (developed on Node 26).

```bash
npm install
npm install --prefix web
npm run dev:server     # API on http://localhost:3000; local PGlite database in .data/ (first start ~15 s), seeded with SAMPLE data
npm run dev:web        # app on http://localhost:5173
```

Open `http://localhost:5173` on a phone on the same Wi-Fi using the "Network" address Vite prints. Camera capture and geolocation need HTTPS on a phone outside localhost; for a real device test use a tunnel or `vite --https`.

```bash
npm test               # 69 server tests, on an in-process Postgres (PGlite), about 25 s
npm run check:strings  # every UI string exists in all 7 languages with matching {placeholders}
npm run build:web      # production build with service worker
```

When seed data changes, bump `SEED_VERSION` in `server/src/index.ts`; the next start discards the old LOCAL sample database and reseeds. A database behind `DATABASE_URL` is never wiped automatically (`npm run seed` with `CONFIRM_RESET=yes` does it on purpose).

Deploying (Supabase + an API host + Vercel): see [DEPLOY.md](DEPLOY.md). Settings are listed in `.env.example`.

### Sign-in

- **Demo mode** (no Supabase variables set, the default for local development): Profile → Demo accounts switches between sample users: two workers, two recyclers, one repairer, one auditor.
- **Real sign-in** (Supabase configured, see [DEPLOY.md](DEPLOY.md)): mobile number and SMS code, once per phone. A new user then chooses worker, recycler or repairer (final) and fills in details. Recyclers and repairers wait for an auditor's approval, enforced on the server. Auditors are created by phone number with `npm run auditor`. Identity checks (KYC) are still simulated and no Aadhaar or PAN is stored.

## Tests

Unit tests cover the hash chain (editing or deleting any stored lot fails verification), the price calculator, the fraud rules, the OCR-to-model matcher, bids and receipts, repair counts, and the API end to end (scan to accepted bid to receipt PDF).

## What is mocked or stubbed

| Item | Status |
|---|---|
| Condition grade | Real when `ANTHROPIC_API_KEY` is set (Claude vision, after the worker agrees); otherwise off. An AI estimate from photos, not an appraisal. The grade factors are SAMPLE numbers. |
| Device-type classifier | **Stub.** Returns the worker's chosen type at 50% confidence. A real vision model or API goes behind the `Classifier` interface. User corrections are logged in `feedback` as future training data. |
| OCR | Real (tesseract.js), but may be slow or offline: the scan never blocks on it, and the worker can type the label text. |
| Prices, rates, compositions | Sample data. The rate table is editable; sources (recycler-published, accepted-bid average, exchange benchmark) are not wired up. |
| Payout (UPI) | Simulated confirmation screen only. |
| Identity / KYC | Phone number verified by SMS code (Supabase Auth). KYC status is simulated; no ID documents are collected. |
| Hindi audio | Uses the device's text-to-speech voice. If no Hindi voice is installed, the app says so. Pre-recorded audio would replace it. |
| Receipt format | Prototype. Must be checked against current CPCB requirements. The PDF uses a Latin font, so amounts read "Rs." and text is English. |
| Photo comparison | Exact SHA-256 match only. Near-duplicate (perceptual hash) detection is not built. |
| Demo lots | Seeded lots carry obviously synthetic sample pictures. Photos taken in the app are stored and shown. |

## Limitations

- No offline queue yet: it needs a network to scan and sync (PWA caches the app shell only).
- GPS is optional; without it the GPS rule cannot run.
- Photos are stored in a private Supabase Storage bucket (or on local disk in dev) under their SHA-256, and shown only through short-lived signed links that the API grants to people allowed to see them. See [DEPLOY.md](DEPLOY.md). **Delete my data** removes the user's rows and their photo files, and anonymises the account.
- Lighthouse accessibility has not been measured. The design follows the rules (44 px targets, 14 px+ text, labelled icon buttons, not colour alone) but needs an audit on real devices.
- All non-English UI strings (Hindi, Bengali, Tamil, Telugu, Marathi, Gujarati) were drafted for the prototype and need review by native speakers. The safety content needs expert review.
- Safety steps and repair guides come from the server in Hindi and English only. In the other four languages the app shows Hindi for that content and says so. The receipt PDF is English only.
- Listen (speech) uses the device voice for Hindi or English content.

## Ethics

- Never presents a model guess as certain; the worker confirms, and corrections are logged.
- Stores the minimum. Photos and GPS exist only to verify lots. Users can delete their data.
- No real payments, no real KYC, no claims of certification.
- The hash chain is described honestly (tamper-evidence, not truth).

## Next steps for real-world deployment

1. Partner with an NGO or worker collective for field testing and trust.
2. Have EHS and e-waste experts review and certify the safety content; replace TTS with recorded audio by native speakers.
3. Replace sample rates with real sources (authorised recycler price lists, accepted-bid averages, an exchange benchmark as a sanity check).
4. Integrate a real payment rail (UPI) and compliant KYC, with legal review.
5. Confirm the receipt format with CPCB requirements and authorised recyclers.
6. Train and evaluate a real device classifier on field photos; add perceptual-hash duplicate detection.
7. Add the offline-first queue, price history, battery quarantine tracker, parts harvest and worker health log (stretch goals).
