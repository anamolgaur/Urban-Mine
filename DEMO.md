# Urban Mine: 3-minute demo script

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
11. **Put on sale**, then **Demo: add sample offers**. Offers appear with countdowns. Accept the best: confirm, then the **simulated UPI** screen.
12. **View receipt** then **Download PDF**: seller name and address, lot id, weight, price, hash, and the "check against CPCB" label.

## 2:35 – Auditor (25 s)
13. Profile → Demo accounts → **SAMPLE Auditor Priya** (opens the console).
14. KPI strip and lot table: flags for duplicate photo, unusual weight, far from workshop, skipped safety steps, many lots quickly.
15. Open the duplicate-photo lot: findings and the photo comparison. Tap **Hold payout**. (As the worker, accepting is now blocked.)
16. Mention the editable rate table with stale rows, and the safety content editor.

## Close (10 s)
"Worker-first, honest about what is sample and mocked, and ready for an NGO partner, expert safety review and real rate sources."

## If something goes wrong
- *Server not reachable banner:* start `npm run dev:server`, press Retry.
- *Fresh data:* stop the server, delete `urban-mine.db`, start again.
- *No Hindi voice:* the app shows a note; use English audio or skip Listen.
