import type { Db, Row } from './db.ts';
import type { PhotoStore } from './photostore.ts';
import { seedDemo } from './demo.ts';

/**
 * Demo accounts for showing the app (e.g. to a hackathon panel). They are real sign-ins (email or the made-up phone number,
 * plus the demo password) on the live app, and come with SAMPLE lots, offers, fraud flags and repair jobs to explore.
 * The phone numbers use the 55500 series, which is not given to mobiles in India, and the emails use example.com, so no real person is reached.
 * Ids match the sample data in seed/users.ts, so seedDemo() fills them in.
 */
export const DEMO_WORKSHOPS = [
  { id: 'ws-1', name: 'Asha Scrap Works', address: 'Lane 4, Seelampur, Delhi', lat: 28.6692, lng: 77.2655 },
  { id: 'ws-2', name: 'Ravi Kabadi Store', address: 'Block C, Tangra, Kolkata', lat: 22.5535, lng: 88.3913 },
  { id: 'ws-3', name: 'Salma E-Waste Corner', address: 'Lane 2, Mustafabad, Delhi', lat: 28.7140, lng: 77.2730 },
];
export const DEMO_ACCOUNTS = [
  { id: 'u-worker-1', role: 'worker', name: 'Asha Devi (demo)', email: 'asha.worker@example.com', phone: '+915550000101', language: 'hi', workshop_id: 'ws-1', approval: 'approved', note: 'Lots on sale with offers, a sold lot' },
  { id: 'u-worker-2', role: 'worker', name: 'Ravi Kumar (demo)', email: 'ravi.worker@example.com', phone: '+915550000102', language: 'hi', workshop_id: 'ws-2', approval: 'approved', note: 'Lots the fraud checks flag' },
  { id: 'u-worker-3', role: 'worker', name: 'Salma Begum (demo)', email: 'salma.worker@example.com', phone: '+915550000103', language: 'en', workshop_id: 'ws-3', approval: 'approved', note: 'Empty: try the whole flow from the start' },
  { id: 'u-recycler-1', role: 'recycler', name: 'GreenCycle Recyclers (demo)', email: 'greencycle.buyer@example.com', phone: '+915550000111', language: 'en', workshop_id: null, approval: 'approved', note: 'Approved buyer with open bids' },
  { id: 'u-recycler-2', role: 'recycler', name: 'Eastern E-Waste Co. (demo)', email: 'eastern.buyer@example.com', phone: '+915550000112', language: 'en', workshop_id: null, approval: 'approved', note: 'Approved buyer' },
  { id: 'u-recycler-3', role: 'recycler', name: 'Metro E-Waste Buyers (demo)', email: 'metro.buyer@example.com', phone: '+915550000113', language: 'en', workshop_id: null, approval: 'pending', note: 'Waiting for auditor approval' },
  { id: 'u-repairer-1', role: 'repairer', name: 'Mohan Repairs (demo)', email: 'mohan.repair@example.com', phone: '+915550000121', language: 'hi', workshop_id: null, approval: 'approved', note: 'Repair jobs, before and after photos' },
  { id: 'u-auditor-1', role: 'auditor', name: 'Priya Sharma (demo)', email: 'priya.auditor@example.com', phone: '+915550000131', language: 'en', workshop_id: null, approval: 'approved', note: 'Flags, holds, approvals, rates; can reset the demo' },
  { id: 'u-auditor-2', role: 'auditor', name: 'Imran Khan (demo)', email: 'imran.auditor@example.com', phone: '+915550000132', language: 'en', workshop_id: null, approval: 'approved', note: 'Second auditor' },
] as const;

const IDS = DEMO_ACCOUNTS.map((a) => a.id) as string[];
export const isDemoId = (id: unknown) => IDS.includes(String(id));

/** Put the demo accounts back as they should be (names, approval, workshops) and link them to their sign-ins. */
async function restoreAccounts(db: Db) {
  const now = new Date().toISOString();
  for (const w of DEMO_WORKSHOPS) {
    await db.prepare('INSERT INTO workshop VALUES (?,?,?,?,?) ON CONFLICT (id) DO UPDATE SET name = excluded.name, address = excluded.address, lat = excluded.lat, lng = excluded.lng').run(w.id, w.name, w.address, w.lat, w.lng);
  }
  for (const a of DEMO_ACCOUNTS) {
    await db.prepare(`INSERT INTO app_user (id, role, name, phone, email, language, workshop_id, approval, kyc_status, consented_at, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT (id) DO UPDATE SET role = excluded.role, name = excluded.name, phone = excluded.phone, email = excluded.email, workshop_id = excluded.workshop_id, approval = excluded.approval`)
      .run(a.id, a.role, a.name, a.phone, a.email, a.language, a.workshop_id, a.approval, 'simulated', now, now);
  }
  await db.prepare("INSERT INTO repairer_listing VALUES ('rl-1','u-repairer-1',?,?,?,?,?) ON CONFLICT (id) DO NOTHING").run(JSON.stringify(['phone', 'charger', 'laptop']), 'Seelampur, Delhi', 150, '10:00-19:00', 0);
  // Link each to the Supabase sign-in with the same email. Only exists on the real (Supabase) database, not on the local test one.
  try {
    await db.exec(`UPDATE app_user u SET auth_id = a.id::text FROM auth.users a WHERE lower(a.email) = u.email AND u.id IN (${IDS.map((i) => `'${i}'`).join(',')}) AND (u.auth_id IS NULL OR u.auth_id <> a.id::text)`);
  } catch { /* no auth schema here */ }
}

/** Delete everything the demo accounts made or received, then load the sample story again. Real accounts are not touched. */
export async function resetDemo(db: Db, photos?: PhotoStore) {
  const list = IDS.map(() => '?').join(',');
  await db.tx(async (t) => {
    const lots = (await t.prepare(`SELECT id FROM lot WHERE user_id IN (${list})`).all(...IDS) as Row[]).map((r) => r.id);
    const inLots = lots.length ? lots.map(() => '?').join(',') : "''";
    await t.prepare(`DELETE FROM recycler_rating WHERE lot_id IN (${inLots}) OR worker_id IN (${list}) OR recycler_id IN (${list})`).run(...lots, ...IDS, ...IDS);
    await t.prepare(`DELETE FROM bid WHERE lot_id IN (${inLots}) OR recycler_id IN (${list})`).run(...lots, ...IDS);
    await t.prepare(`DELETE FROM flag WHERE lot_id IN (${inLots})`).run(...lots);
    await t.prepare(`DELETE FROM lot WHERE user_id IN (${list})`).run(...IDS);
    await t.prepare(`DELETE FROM feedback WHERE scan_id IN (SELECT id FROM scan WHERE user_id IN (${list}))`).run(...IDS);
    await t.prepare(`DELETE FROM scan WHERE user_id IN (${list})`).run(...IDS);
    await t.prepare(`DELETE FROM photo_upload WHERE user_id IN (${list})`).run(...IDS);
    await t.prepare(`DELETE FROM vision_usage WHERE user_id IN (${list})`).run(...IDS);
    await t.prepare(`DELETE FROM repair_job WHERE listing_id IN (SELECT id FROM repairer_listing WHERE user_id IN (${list}))`).run(...IDS);
    await t.prepare(`DELETE FROM repairer_listing WHERE user_id IN (${list}) AND id <> 'rl-1'`).run(...IDS);
  });
  await restoreAccounts(db);
  await seedDemo(db, new Date(), photos);
}

/** On start: make sure the demo accounts exist, and give them the sample story if they have no lots yet. */
export async function ensureDemo(db: Db, photos?: PhotoStore) {
  await restoreAccounts(db);
  if (!(await db.prepare("SELECT 1 FROM lot WHERE user_id = 'u-worker-1'").get())) await seedDemo(db, new Date(), photos);
}
