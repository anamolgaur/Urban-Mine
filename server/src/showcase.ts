// `npm run showcase` adds a realistic set of SAMPLE people and activity to a database, so the app has something to show:
// 10 workers, 5 recyclers (plus 1 waiting for approval), 3 repairers (plus 1 waiting), their lots, offers, sales and repair jobs.
// `npm run showcase -- --remove` takes all of it out again. Your own accounts and real data are never touched.
//
// Every sample person is marked "(sample)" and has no phone or email, so nobody can ever sign in as them.
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { openDb, getMeta, setMeta, type Db } from './db.ts';
import { createLot } from './lots.ts';
import { listLot, placeBid, acceptBid } from './market.ts';
import { recordFlags } from './fraud.ts';
import { estimate } from './price.ts';
import { resaleRange } from './resale.ts';
import { upsertListing, createJob, updateJob, completeJob } from './repair.ts';
import { writeSamplePhotos } from './samplephoto.ts';
import { SupabasePhotoStore, LocalPhotoStore, type PhotoStore } from './photostore.ts';

type Row = Record<string, any>;
const PREFIX = 'sx-';
const KEY = 'showcase_version';

const url = process.env.DATABASE_URL;
const db = await openDb(url ? { url } : { dataDir: process.env.PGLITE_DIR ?? '.data/urban-mine' });
const photos: PhotoStore = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  ? new SupabasePhotoStore({ url: process.env.SUPABASE_URL, serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY, bucket: process.env.PHOTO_BUCKET || 'photos' })
  : new LocalPhotoStore(resolve('uploads'), process.env.PHOTO_URL_SECRET);

async function remove(d: Db) {
  const like = PREFIX + '%';
  await d.tx(async (t) => {
    await t.prepare(`DELETE FROM bid WHERE lot_id IN (SELECT id FROM lot WHERE user_id LIKE ?) OR recycler_id LIKE ?`).run(like, like);
    await t.prepare(`DELETE FROM flag WHERE lot_id IN (SELECT id FROM lot WHERE user_id LIKE ?)`).run(like);
    await t.prepare(`DELETE FROM lot WHERE user_id LIKE ?`).run(like);
    await t.prepare(`DELETE FROM repair_job WHERE listing_id IN (SELECT id FROM repairer_listing WHERE user_id LIKE ?)`).run(like);
    await t.prepare(`DELETE FROM repairer_listing WHERE user_id LIKE ?`).run(like);
    await t.prepare(`DELETE FROM app_user WHERE id LIKE ?`).run(like);
    await t.prepare(`DELETE FROM workshop WHERE id LIKE ?`).run(like);
    await t.prepare(`DELETE FROM meta WHERE key = ?`).run(KEY);
  });
}

if (process.argv.includes('--remove')) {
  await remove(db);
  console.log('Sample people and their lots, offers and repair jobs were removed. Your own accounts were not touched.');
  await db.close(); process.exit(0);
}
if (await getMeta(db, KEY)) {
  console.log('Sample data is already there. To redo it: npm run showcase -- --remove, then npm run showcase.');
  await db.close(); process.exit(0);
}
if (!((await db.prepare('SELECT COUNT(*)::int AS n FROM rate').get()) as Row).n) {
  console.error('This database has no prices yet. Start the app once (npm run dev:server, or deploy on Render) so they load, then run this again.');
  await db.close(); process.exit(1);
}

// ---------- people ----------
const now = Date.now();
const ago = (h: number) => new Date(now - h * 3600_000).toISOString();
const hash = (s: string) => createHash('sha256').update('urban-mine-sample:' + s).digest('hex');
const photoHashes = new Set<string>();
const pic = (s: string) => { const h = hash(s); photoHashes.add(h); return h; };

const WORKERS = [
  ['w01', 'Kavita Devi', 'Kavita Scrap Works', 'Lane 4, Seelampur, Delhi', 28.6692, 77.2655, 'hi'],
  ['w02', 'Ramesh Kumar', 'Ramesh Kabadi Store', 'Block B, Mustafabad, Delhi', 28.7124, 77.2738, 'hi'],
  ['w03', 'Salma Begum', 'Salma Recycling', 'Gali 7, Jafrabad, Delhi', 28.6845, 77.2762, 'hi'],
  ['w04', 'Mohd. Irfan', 'Irfan Electronics Scrap', 'Shastri Park, Delhi', 28.6688, 77.2503, 'hi'],
  ['w05', 'Sunita Yadav', 'Sunita Kabadiwala', 'Mandoli Road, Delhi', 28.7010, 77.3005, 'hi'],
  ['w06', 'Deepak Singh', 'Deepak Traders', 'Old Seemapuri, Delhi', 28.6871, 77.3197, 'hi'],
  ['w07', 'Rahim Sheikh', 'Rahim E-Waste', 'Block C, Tangra, Kolkata', 22.5535, 88.3913, 'bn'],
  ['w08', 'Mita Das', 'Mita Scrap Shop', 'Topsia Road, Kolkata', 22.5402, 88.3880, 'bn'],
  ['w09', 'Bablu Mondal', 'Bablu Kabadi', 'Rajabazar, Kolkata', 22.5797, 88.3712, 'bn'],
  ['w10', 'Anwar Ali', 'Anwar Collection Point', 'Tiljala, Kolkata', 22.5281, 88.3891, 'bn'],
] as const;
const RECYCLERS = [
  ['r01', 'GreenLoop Recyclers', 'approved'], ['r02', 'Eastern E-Waste Co.', 'approved'], ['r03', 'Delhi Metal Recovery', 'approved'],
  ['r04', 'ReNew Circuits Pvt. Ltd.', 'approved'], ['r05', 'Bengal Green Processing', 'approved'], ['r06', 'Quick Scrap Buyers', 'pending'],
] as const;
const REPAIRERS = [
  ['p01', 'Mohan Mobile Repairs', 'Seelampur, Delhi', ['phone', 'charger', 'tablet'], 150, 'approved'],
  ['p02', 'Laptop Clinic Jafrabad', 'Jafrabad, Delhi', ['laptop', 'charger', 'router'], 400, 'approved'],
  ['p03', 'Sarkar Electronics', 'Tangra, Kolkata', ['phone', 'lcd_monitor', 'set_top_box'], 200, 'approved'],
  ['p04', 'FixIt Point', 'Topsia, Kolkata', ['phone'], 120, 'pending'],
] as const;

const id = (s: string) => PREFIX + s;
await db.tx(async (t) => {
  for (const [k, name, shop, addr, lat, lng, lang] of WORKERS) {
    await t.prepare('INSERT INTO workshop VALUES (?,?,?,?,?)').run(id('ws-' + k), shop, addr, lat, lng);
    await t.prepare('INSERT INTO app_user (id, role, name, phone, language, workshop_id, approval, kyc_status, consented_at, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)')
      .run(id(k), 'worker', `${name} (sample)`, null, lang, id('ws-' + k), 'approved', 'simulated', ago(24 * 30), ago(24 * 30));
  }
  for (const [k, name, approval] of RECYCLERS)
    await t.prepare('INSERT INTO app_user (id, role, name, phone, language, workshop_id, approval, kyc_status, consented_at, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)')
      .run(id(k), 'recycler', `${name} (sample)`, null, 'en', null, approval, 'simulated', ago(24 * 20), ago(approval === 'pending' ? 5 : 24 * 20));
  for (const [k, name, , , , approval] of REPAIRERS)
    await t.prepare('INSERT INTO app_user (id, role, name, phone, language, workshop_id, approval, kyc_status, consented_at, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)')
      .run(id(k), 'repairer', `${name} (sample)`, null, 'hi', null, approval, 'simulated', ago(24 * 25), ago(approval === 'pending' ? 3 : 24 * 25));
});

// ---------- lots, offers and sales ----------
type Item = { type: string; qty: number; model_id?: string; works?: true; resale_id?: string; condition?: 'good' | 'fair' | 'poor' };
const KIT: { items: Item[]; kg: number; steps: [number, number] }[] = [
  { items: [{ type: 'phone', qty: 6 }], kg: 1.1, steps: [3, 3] },
  { items: [{ type: 'charger', qty: 10 }], kg: 1.2, steps: [0, 0] },
  { items: [{ type: 'laptop', qty: 2 }], kg: 4.1, steps: [4, 4] },
  { items: [{ type: 'phone', qty: 1, works: true, resale_id: 'rs-note13', condition: 'good' }], kg: 0.2, steps: [0, 0] },
  { items: [{ type: 'phone', qty: 1, works: true, resale_id: 'rs-ip13', condition: 'fair' }], kg: 0.2, steps: [0, 0] },
  { items: [{ type: 'router', qty: 4 }], kg: 1.1, steps: [0, 0] },
  { items: [{ type: 'phone', qty: 12 }], kg: 2.3, steps: [2, 3] },
  { items: [{ type: 'laptop', qty: 1, works: true, resale_id: 'rs-thinkpad', condition: 'fair' }], kg: 2.0, steps: [0, 0] },
  { items: [{ type: 'set_top_box', qty: 5 }], kg: 2.0, steps: [0, 0] },
  { items: [{ type: 'lcd_monitor', qty: 2 }], kg: 7.3, steps: [0, 0] },
  { items: [{ type: 'phone', qty: 1, works: true, resale_id: 'rs-a13', condition: 'good' }], kg: 0.2, steps: [0, 0] },
  { items: [{ type: 'crt_monitor', qty: 1 }], kg: 11.5, steps: [4, 4] },
];
const TERMS = ['Pickup tomorrow 10am, cash on pickup', 'Pickup today 6pm', 'Pickup in 2 days, bank transfer', 'Same-day pickup, bring the lot to the gate'];

async function fairMid(items: Item[], city: string) {
  let low = 0, high = 0;
  for (const it of items) {
    const r = it.works ? resaleRange({ resaleId: it.resale_id, condition: it.condition }) : null;
    const e = r ?? await estimate(db, city, { modelId: it.model_id, type: it.type });
    if (e) { low += e.low * it.qty; high += e.high * it.qty; }
  }
  return { low, high, mid: (low + high) / 2 };
}

const approved = RECYCLERS.filter((r) => r[2] === 'approved').map((r) => id(r[0]));
let n = 0, sold = 0, bids = 0;
for (const [wi, w] of WORKERS.entries()) {
  const city = w[3].split(',').pop()!.trim();
  const count = 2 + (wi % 3); // 2 to 4 lots each
  for (let j = 0; j < count; j++) {
    const kit = KIT[(wi * 3 + j * 5) % KIT.length];
    const hoursAgo = 24 * (9 - j * 2) + wi * 3; // oldest first, so each worker's chain is in order
    const jitter = () => (((wi * 7 + j * 13) % 10) - 5) / 4000;
    const lot = await createLot(db, {
      user_id: id(w[0]), items: kit.items, weight_kg: kit.kg, steps_done: kit.steps[0], steps_total: kit.steps[1],
      photo_hashes: [pic(`${w[0]}-${j}-a`), pic(`${w[0]}-${j}-b`)], gps: { lat: w[4] + jitter(), lng: w[5] + jitter() }, created_at: ago(hoursAgo),
    });
    n++;
    const stage = (wi + j) % 4; // 0 sold, 1 on sale with offers, 2 on sale without offers, 3 not listed yet
    if (stage === 3) { await recordFlags(db, lot.id); continue; }
    await listLot(db, lot.id, id(w[0]));
    await recordFlags(db, lot.id);
    if (stage === 2) continue;
    const { low, mid } = await fairMid(kit.items, city);
    const offers: string[] = [];
    for (let b = 0; b < 2 + ((wi + j) % 2); b++) {
      const factor = [1.04, 0.96, 1.0][b];
      const amount = Math.max(Math.round(low * 0.82) + 1, Math.round(mid * factor));
      const r = await placeBid(db, { lotId: lot.id, recyclerId: approved[(wi + j + b) % approved.length], amount, pickupTerms: TERMS[(wi + b) % TERMS.length], minutes: 60 * 24 * 3, now: new Date(now - (stage === 0 ? 3600_000 : 0)) });
      offers.push(r.id); bids++;
    }
    if (stage === 0) { await acceptBid(db, offers[0], id(w[0])); sold++; }
  }
}

// ---------- repairers ----------
let jobs = 0;
for (const [k, , area, skills, price, approval] of REPAIRERS) {
  if (approval !== 'approved') continue;
  const listing = await upsertListing(db, id(k), { skills: [...skills], area, start_price: price, hours: '10:00-20:00' });
  const plan = [
    { guide: skills[0] === 'laptop' ? 'rg-laptop-slow' : 'rg-phone-screen', type: skills[0], done: true, days: 6, note: 'Customer drop-in', diary: { problems: 'Screws were stripped; used a rubber band to grip them.', parts: skills[0] === 'laptop' ? 'SSD 256 GB' : 'Replacement screen', minutes: 55, outcome: 'fixed' as const } },
    { guide: 'rg-charger-cable', type: 'charger', done: true, days: 3, note: 'Frayed cable', diary: { problems: 'None', parts: 'USB cable', minutes: 15, outcome: 'fixed' as const } },
    { guide: skills[0] === 'laptop' ? 'rg-laptop-nocharge' : 'rg-phone-battery', type: skills[0], done: true, days: 2, note: 'Will not hold charge', diary: { problems: 'Board damage near the socket, beyond a simple fix.', parts: 'None', minutes: 40, outcome: 'not_fixed' as const } },
    { guide: 'rg-phone-battery', type: 'phone', done: false, days: 0.2, note: 'Battery swollen', diary: { problems: 'Battery was swollen; moved it to the metal tray first.' } },
  ];
  for (const [i, p] of plan.entries()) {
    const started = new Date(now - p.days * 86400_000);
    const job = await createJob(db, listing, pic(`${k}-${i}-before`), p.note, started, { device_type: p.type, guide_id: p.guide, gear: ['glasses', 'gloves', 'unplugged', 'battery_tray'] });
    await updateJob(db, job, { during_photo: pic(`${k}-${i}-during`), step: 0 });
    await updateJob(db, job, { step: 1, diary: p.diary });
    if (p.done) await completeJob(db, job, pic(`${k}-${i}-after`), new Date(started.getTime() + 3600_000), p.diary);
    jobs++;
  }
}

await writeSamplePhotos(photos, photoHashes);
await setMeta(db, KEY, '1');
console.log(`Added sample data: ${WORKERS.length} workers, ${RECYCLERS.length} recyclers (1 waiting for approval), ${REPAIRERS.length} repairers (1 waiting), ${n} lots (${sold} sold), ${bids} offers, ${jobs} repair jobs, ${photoHashes.size} sample photos.`);
console.log('To take it all out again: npm run showcase -- --remove');
await db.close();
