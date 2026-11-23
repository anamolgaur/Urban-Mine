# Urban Mine: demo for a panel

## Demo accounts (live app)
Sign in at https://urban-mine-api.onrender.com with the **email or the phone number** below and the shared demo password (kept out of this public repo: ask the team).
Every demo account shows a black **"Demo account"** strip. They share sample data with everyone trying the app, so a demo auditor can press **Reset demo** at any time to start over. Real accounts are never touched by a reset.

| Role | Name | Email | Phone | What to show |
|---|---|---|---|---|
| Worker | Asha Devi | asha.worker@example.com | +91 55500 00101 | Lots on sale with live offers, a sold lot, receipt |
| Worker | Ravi Kumar | ravi.worker@example.com | +91 55500 00102 | Lots the fraud checks flag (duplicate photo, far GPS, skipped safety steps) |
| Worker | Salma Begum | salma.worker@example.com | +91 55500 00103 | Empty account: try the whole flow from the first scan |
| E-waste buyer (recycler) | GreenCycle Recyclers | greencycle.buyer@example.com | +91 55500 00111 | Marketplace, bidding, bid floor |
| E-waste buyer (recycler) | Eastern E-Waste Co. | eastern.buyer@example.com | +91 55500 00112 | Second bidder |
| E-waste buyer (recycler) | Metro E-Waste Buyers | metro.buyer@example.com | +91 55500 00113 | Waiting for approval (an auditor approves it) |
| Repairer | Mohan Repairs | mohan.repair@example.com | +91 55500 00121 | Repair jobs with before and after photos |
| Auditor | Priya Sharma | priya.auditor@example.com | +91 55500 00131 | Flags, holds, approvals, rates, account removal, **Reset demo** |
| Auditor | Imran Khan | imran.auditor@example.com | +91 55500 00132 | Second auditor |

The phone numbers use the 55500 series (not given to mobiles in India) and the emails use example.com, so no real person is reached. Turn the demo accounts off with `DEMO_ACCOUNTS=0`.

## 5-minute panel run
1. **Worker (Salma):** Scan a device. No phone to photograph? Tap a picture under **Or try a sample photo** (real e-waste photos). The AI on the phone suggests the type and model; confirm, see the fair price, say whether it works.
2. Follow the **safe dismantling** steps, create the lot (record hash), **Put on sale**, then **Demo: add sample offers**. Accept one; open the **receipt** and share it.
3. **Buyer (GreenCycle):** the marketplace with photo evidence; try a bid under the floor (blocked).
4. **Auditor (Priya):** KPIs, flagged lots (sign in as Ravi to show why), hold a payout, approve **Metro E-Waste Buyers**, export the CSV, show the **Remove** button and the offensive-name check.
5. **Reset demo** before the next group.

## Security checks a panel may try (all refused)
Typing /auditor, changing ids in the URL, signing up as an auditor, a fake token, reading the database with the public key, negative or huge numbers, non-photo uploads, offensive names at sign-up.

---

# Local demo (no Supabase): 3-minute script

Setup: `npm run dev:server` and `npm run dev:web`. Open `http://localhost:5173` in a phone-size window (or on a phone). The app opens in Hindi as **SAMPLE Worker Asha**. Say once at the start: *all data is sample, payments are simulated, the safety content is a draft.*

Prepare before you start: the browser has no camera, so on a laptop the "photo" buttons open a file picker. Keep four small images ready.

## 0:00 – The problem (20 s)
"Informal e-waste workers do most of India's collection but have no price information, no safety guidance and no proof of their work. Recyclers need documented purchases. Urban Mine gives workers a fair price, safe steps and a verifiable record."

## 0:20 – Scan (30 s)
1. Home: point at today's rates (▲▼ change versus yesterday, tagged SAMPLE). Tap **Scan a device**.
2. Choose **Phone**, add photos (top, underside, back, label). In "Model on the label" type `Arka A1` (stands in for the label OCR). Tap **Check device**.
3. Confirm screen: "Probably Arka A1. Is this right?" with **67% match, not certain**. Tap **Yes**. Mention: a wrong guess is logged for training, and the classifier is a stub we will replace.

## 0:50 – Price and repair (25 s)
4. Result: the price **range**, the stacked composition bar, per-material grams and rupees.
5. Tap **Yes, it works**: the repair-vs-recycle comparison recommends repair. "A device that still works is worth more repaired."
6. Switch the language to English and back with the globe button to show every string changes.

## 1:15 – Safe dismantling (35 s)
7. Tap **Dismantle safely**. Show the **DRAFT CONTENT** banner and the "call 112" line. Tick the gear.
8. Step 1, then tap **Listen** (Hindi audio). Step 2 is the **battery**: the Done button stays disabled until a proof photo is taken.
9. Finish the steps.

## 1:50 – Verified lot and sale (45 s)
10. Create lot: enter weight, add location. The **record hash** appears. Read the honest line: "proves it was not changed afterwards, not that the first entry was true."
11. **Put on sale**, then **Demo: add sample offers**. Offers appear with countdowns. **Reject** one, then accept the best: confirm, then the **simulated UPI** screen.
12. **View receipt** then **Download PDF**: seller name and address, lot id, weight, price, hash, and the "check against CPCB" label.

## 2:35 – Auditor (25 s)
13. Profile → Demo accounts → **SAMPLE Auditor Priya** (opens the console).
14. KPI strip and lot table: flags for duplicate photo, unusual weight, far from workshop, skipped safety steps, many lots quickly.
15. Open the duplicate-photo lot: findings and the photo comparison. Tap **Hold payout**. (As the worker, accepting is now blocked.)
16. Mention the editable rate table with stale rows, and the safety content editor. Show the **hash-chain verification** panel on any lot.
17. Optional: switch to **SAMPLE Recycler Alpha** for the marketplace table with photo evidence, and **SAMPLE Repairer Mohan** for the jobs dashboard.

## Close (10 s)
"Worker-first, honest about what is sample and mocked, and ready for an NGO partner, expert safety review and real rate sources."

## If something goes wrong
- *Server not reachable banner:* start `npm run dev:server`, press Retry.
- *Fresh data:* run `npm run seed` (local database), then start the server again.
- *No Hindi voice:* the app shows a note; use English audio or skip Listen.
