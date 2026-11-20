import Fastify, { type FastifyRequest } from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import { mkdirSync, unlinkSync } from 'node:fs';
import { resolve, join } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { getSafetyPack, listSafetyTypes, isLang, type SafetyPack } from './safety.ts';
import { estimate, getRates, setRate, staleRates } from './price.ts';
import { runScan, saveFeedback } from './scan.ts';
import { StubClassifier, TesseractOcr, type Classifier, type Ocr } from './vision.ts';
import { loadModels } from './matcher.ts';
import { createLot } from './lots.ts';
import { recordFlags } from './fraud.ts';
import { listLot, placeBid, offersFor, bidsFor, acceptBid, rejectBid, holdLot, releaseLot, requestRecheck } from './market.ts';
import { receiptData, renderReceiptPdf } from './receipt.ts';
import { repairComparison, listGuides, listListings, upsertListing, createJob, completeJob } from './repair.ts';
import { savePhoto, parseDataUrl } from './photos.ts';
import { lotView, lotsFor, chainStatus, chainDetail } from './views.ts';

type Row = Record<string, any>;
export type AppDeps = { classifier?: Classifier; ocr?: Ocr; uploadsDir?: string };

const E = (statusCode: number, message: string) => Object.assign(new Error(message), { statusCode });
const HASH = /^[0-9a-f]{64}$/;
const cityOf = (address?: string | null) => (address ?? '').split(',').pop()?.trim() || 'Delhi';

export async function buildApp(db: DatabaseSync, deps: AppDeps = {}) {
  const uploadsDir = resolve(deps.uploadsDir ?? 'uploads');
  mkdirSync(uploadsDir, { recursive: true });
  const classifier = deps.classifier ?? new StubClassifier();
  const realOcr = deps.ocr ?? new TesseractOcr();

  const app = Fastify({ bodyLimit: 25 * 1024 * 1024 });
  await app.register(cors);
  await app.register(fastifyStatic, { root: uploadsDir, prefix: '/uploads/' });
  app.setErrorHandler((err: any, _req, reply) => {
    reply.code(err.statusCode ?? 400).send({ error: err.message });
  });

  /** Mocked identity: the demo sends X-User-Id. A real deployment would use OTP login. */
  const actor = (req: FastifyRequest, roles?: string[]): Row => {
    const u = db.prepare('SELECT * FROM user WHERE id = ?').get(String(req.headers['x-user-id'] ?? '')) as Row | undefined;
    if (!u) throw E(401, 'Unknown user');
    if (roles && !roles.includes(u.role)) throw E(403, 'Not allowed for this role');
    return u;
  };
  const lotOwned = (id: string, userId: string) => {
    const l = db.prepare('SELECT * FROM lot WHERE id = ?').get(id) as Row | undefined;
    if (!l || l.user_id !== userId) throw E(404, 'Lot not found');
    return l;
  };

  app.get('/', async () => ({ name: 'Urban Mine API', note: 'ALL DATA IS SAMPLE', try: '/api/safety/phone?lang=hi' }));
  app.get('/api/health', async () => ({ ok: true }));

  // ---------- identity (mocked) ----------
  app.get('/api/users', async () => db.prepare('SELECT id, role, name, language FROM user ORDER BY role, id').all());
  app.get('/api/me', async (req) => {
    const u = actor(req);
    const w = u.workshop_id ? (db.prepare('SELECT * FROM workshop WHERE id = ?').get(u.workshop_id) as Row) : null;
    return { user: u, workshop: w, city: cityOf(w?.address) };
  });
  app.delete('/api/me/data', async (req) => {
    const u = actor(req);
    // remember this user's photo hashes so the image files can be removed after the rows are gone
    const hashes = new Set<string>();
    for (const r of db.prepare('SELECT photo_hashes FROM lot WHERE user_id = ?').all(u.id) as Row[]) for (const h of JSON.parse(r.photo_hashes)) hashes.add(h);
    for (const r of db.prepare('SELECT photos FROM scan WHERE user_id = ?').all(u.id) as Row[]) for (const h of JSON.parse(r.photos)) hashes.add(h);
    for (const r of db.prepare('SELECT j.before_photo b, j.after_photo a FROM repair_job j JOIN repairer_listing l ON l.id = j.listing_id WHERE l.user_id = ?').all(u.id) as Row[]) { if (r.b) hashes.add(r.b); if (r.a) hashes.add(r.a); }
    db.exec('BEGIN');
    try {
      const lots =(db.prepare('SELECT id FROM lot WHERE user_id = ?').all(u.id) as Row[]).map((l) => l.id);
      for (const id of lots) { db.prepare('DELETE FROM bid WHERE lot_id = ?').run(id); db.prepare('DELETE FROM flag WHERE lot_id = ?').run(id); }
      db.prepare('DELETE FROM feedback WHERE scan_id IN (SELECT id FROM scan WHERE user_id = ?)').run(u.id);
      db.prepare('DELETE FROM scan WHERE user_id = ?').run(u.id);
      db.prepare('DELETE FROM lot WHERE user_id = ?').run(u.id);
      db.prepare('DELETE FROM repair_job WHERE listing_id IN (SELECT id FROM repairer_listing WHERE user_id = ?)').run(u.id);
      db.prepare('DELETE FROM repairer_listing WHERE user_id = ?').run(u.id);
      db.prepare("UPDATE user SET name = 'Deleted user', phone = NULL WHERE id = ?").run(u.id);
      db.exec('COMMIT');
    } catch (e) { db.exec('ROLLBACK'); throw e; }
    for (const h of hashes) {
      if (!HASH.test(h)) continue;
      const shared = db.prepare('SELECT 1 FROM lot WHERE photo_hashes LIKE ? UNION SELECT 1 FROM scan WHERE photos LIKE ?').get(`%"${h}"%`, `%"${h}"%`);
      if (!shared) { try { unlinkSync(join(uploadsDir, h + '.jpg')); } catch { /* already gone */ } }
    }
    return { deleted: true, photos_removed: hashes.size };
  });

  // ---------- reference data ----------
  app.get('/api/models', async () => loadModels(db));
  app.get<{ Querystring: { city?: string } }>('/api/rates', async (req) => getRates(db, req.query.city ?? 'Delhi'));
  app.get<{ Querystring: { city?: string; modelId?: string; type?: string } }>('/api/estimate', async (req) => {
    const city = req.query.city ?? 'Delhi';
    const est = estimate(db, city, { modelId: req.query.modelId, type: req.query.type });
    if (!est) throw E(404, 'No composition data for this device');
    return { ...est, rates: getRates(db, city) };
  });
  app.get<{ Querystring: { city?: string; type?: string; modelId?: string; works?: string } }>('/api/repair/decision', async (req) => {
    const r = repairComparison(db, req.query.city ?? 'Delhi', { type: String(req.query.type), modelId: req.query.modelId, works: req.query.works === 'true' });
    if (!r) throw E(404, 'No repair data for this device');
    return r;
  });

  // ---------- photos & scan ----------
  app.post('/api/photos', async (req) => {
    actor(req);
    return { hash: savePhoto(uploadsDir, (req.body as any)?.dataUrl) };
  });

  app.post('/api/scan', async (req) => {
    const u = actor(req, ['worker']);
    const b = req.body as { images?: string[]; hint?: string; ocrText?: string };
    if (!Array.isArray(b?.images) || b.images.length < 1 || b.images.length > 6) throw E(400, '1 to 6 images are required');
    const hashes = b.images.map((i) => savePhoto(uploadsDir, i));
    const buffers = b.images.map(parseDataUrl);
    // OCR may be slow or offline: never let it block the scan. Typed label text overrides it.
    const ocr: Ocr = {
      read: async (img) => {
        if (b.ocrText?.trim()) return b.ocrText;
        try { return await Promise.race([realOcr.read(img), new Promise<string>((r) => setTimeout(() => r(''), 25000))]); } catch { return ''; }
      },
    };
    const res = await runScan(db, { classifier, ocr }, { userId: u.id, images: buffers, photoRefs: hashes, hint: b.hint });
    return { ...res, photoHashes: hashes };
  });
  app.post<{ Params: { id: string } }>('/api/scan/:id/feedback', async (req) => {
    actor(req, ['worker']);
    const b = req.body as { field: 'type' | 'model'; predicted: string | null; corrected: string | null };
    if (!['type', 'model'].includes(b?.field)) throw E(400, 'field must be type or model');
    return { id: saveFeedback(db, req.params.id, b.field, b.predicted ?? null, b.corrected ?? null) };
  });

  // ---------- safety ----------
  app.get('/api/safety', async () => ({ types: listSafetyTypes(db) }));
  app.get<{ Params: { type: string }; Querystring: { lang?: string } }>('/api/safety/:type', async (req) => {
    const lang = req.query.lang ?? 'hi';
    if (!isLang(lang)) throw E(400, 'lang must be hi or en');
    const pack = getSafetyPack(db, req.params.type, lang);
    if (!pack) throw E(404, 'No safety pack for this device type');
    return pack;
  });
  app.put<{ Params: { type: string; lang: string } }>('/api/safety/:type/:lang', async (req) => {
    actor(req, ['auditor']);
    if (!isLang(req.params.lang)) throw E(400, 'lang must be hi or en');
    const cur = getSafetyPack(db, req.params.type, req.params.lang);
    if (!cur) throw E(404, 'No safety pack');
    const b = req.body as { steps?: { id: string; title?: string; instruction?: string }[]; reviewed_by?: string | null };
    const steps = cur.steps.map((s) => {
      const u = b.steps?.find((x) => x.id === s.id);
      return u ? { ...s, title: u.title?.trim() || s.title, instruction: u.instruction?.trim() || s.instruction } : s;
    });
    const n = Number(cur.version.split('.').pop()) || 0;
    const version = cur.version.replace(/\.\d+$/, '') + '.' + (n + 1);
    const body: Partial<SafetyPack> = { gear: cur.gear, steps, emergency: cur.emergency, draft_banner: cur.draft_banner };
    db.prepare('UPDATE safety_pack SET steps_json = ?, version = ?, reviewed_by = ? WHERE device_type = ? AND language = ?')
      .run(JSON.stringify(body), version, b.reviewed_by?.trim() || null, req.params.type, req.params.lang);
    return getSafetyPack(db, req.params.type, req.params.lang);
  });

  // ---------- lots, offers, receipt (worker) ----------
  app.post('/api/lots', async (req) => {
    const u = actor(req, ['worker']);
    const b = req.body as any;
    if (!Array.isArray(b?.items) || !b.items.length || !b.items.every((i: any) => typeof i.type === 'string' && (i.qty ?? 1) >= 1)) throw E(400, 'items required');
    if (!(b.weight_kg > 0)) throw E(400, 'weight_kg must be positive');
    if (!(b.steps_total >= 0) || !(b.steps_done >= 0) || b.steps_done > b.steps_total) throw E(400, 'invalid step counts');
    if (!Array.isArray(b.photo_hashes) || !b.photo_hashes.every((h: string) => HASH.test(h))) throw E(400, 'photo_hashes must be sha-256 hashes');
    const gps = b.gps && Number.isFinite(b.gps.lat) && Number.isFinite(b.gps.lng) ? { lat: b.gps.lat, lng: b.gps.lng } : null;
    const { id } = createLot(db, { user_id: u.id, items: b.items, weight_kg: b.weight_kg, steps_done: b.steps_done, steps_total: b.steps_total, photo_hashes: b.photo_hashes, gps });
    recordFlags(db, id);
    return lotView(db, db.prepare('SELECT * FROM lot WHERE id = ?').get(id) as Row);
  });
  app.get('/api/lots', async (req) => lotsFor(db, actor(req, ['worker']).id));
  app.get<{ Params: { id: string } }>('/api/lots/:id', async (req) => {
    const u = actor(req);
    const l = db.prepare('SELECT * FROM lot WHERE id = ?').get(req.params.id) as Row | undefined;
    if (!l || (u.role === 'worker' && l.user_id !== u.id)) throw E(404, 'Lot not found');
    const sale = db.prepare("SELECT b.amount, u.name AS buyer FROM bid b JOIN user u ON u.id = b.recycler_id WHERE b.lot_id = ? AND b.status = 'accepted'").get(l.id) as Row | undefined;
    return { ...lotView(db, l), sale: sale ? { amount: sale.amount, buyer: sale.buyer } : null };
  });
  // DEMO ONLY: places two sample offers from sample recyclers so the sell flow can be shown without a second device.
  app.post<{ Params: { id: string } }>('/api/demo/offers/:id', async (req) => {
    const u = actor(req, ['worker']);
    const l = lotOwned(req.params.id, u.id);
    if (l.status !== 'listed') throw E(400, 'Lot is not listed');
    const ws = db.prepare('SELECT w.address FROM workshop w JOIN user x ON x.workshop_id = w.id WHERE x.id = ?').get(u.id) as Row | undefined;
    let base = 0;
    for (const it of JSON.parse(l.items) as Row[]) {
      const e = estimate(db, cityOf(ws?.address), { modelId: it.model_id, type: it.type });
      if (e) base += e.total * (it.qty ?? 1);
    }
    base = Math.max(10, Math.round(base));
    placeBid(db, { lotId: l.id, recyclerId: 'u-recycler-1', amount: Math.round(base * 0.95), pickupTerms: 'SAMPLE: pickup tomorrow 10am', minutes: 30 });
    placeBid(db, { lotId: l.id, recyclerId: 'u-recycler-2', amount: Math.round(base * 0.85), pickupTerms: 'SAMPLE: pickup today 6pm', minutes: 15 });
    return offersFor(db, l.id);
  });
  app.post<{ Params: { id: string } }>('/api/lots/:id/list', async (req) => {
    const u = actor(req, ['worker']);
    lotOwned(req.params.id, u.id);
    listLot(db, req.params.id, u.id);
    return { ok: true };
  });
  app.get<{ Params: { id: string } }>('/api/lots/:id/offers', async (req) => {
    const u = actor(req, ['worker']);
    lotOwned(req.params.id, u.id);
    return offersFor(db, req.params.id);
  });
  app.post<{ Params: { id: string } }>('/api/bids/:id/accept', async (req) => {
    const u = actor(req, ['worker']);
    const r = acceptBid(db, req.params.id, u.id);
    // Mocked UPI payout: no money moves.
    return { ...r, payout: { method: 'UPI (SIMULATED)', status: 'confirmed', reference: 'SIM-' + req.params.id.slice(0, 8).toUpperCase() } };
  });
  app.post<{ Params: { id: string } }>('/api/bids/:id/reject', async (req) => {
    rejectBid(db, req.params.id, actor(req, ['worker']).id);
    return { ok: true };
  });
  app.get<{ Params: { id: string } }>('/api/lots/:id/receipt.pdf', async (req, reply) => {
    const u = actor(req, ['worker', 'auditor', 'recycler']);
    const l = db.prepare('SELECT user_id FROM lot WHERE id = ?').get(req.params.id) as Row | undefined;
    if (!l || (u.role === 'worker' && l.user_id !== u.id)) throw E(404, 'Lot not found');
    const pdf = await renderReceiptPdf(receiptData(db, req.params.id));
    return reply.header('content-type', 'application/pdf').header('content-disposition', `inline; filename="receipt-${req.params.id.slice(0, 8)}.pdf"`).send(pdf);
  });

  // ---------- recycler ----------
  /** Seller location and a SAMPLE expected value for a lot, so a recycler can judge a bid. */
  const lotContext = (lotRow: Row) => {
    const ws = db.prepare('SELECT w.address FROM workshop w JOIN user x ON x.workshop_id = w.id WHERE x.id = ?').get(lotRow.user_id) as Row | undefined;
    const city = cityOf(ws?.address);
    let low = 0, high = 0;
    for (const it of JSON.parse(lotRow.items) as Row[]) {
      const e = estimate(db, city, { modelId: it.model_id, type: it.type });
      if (e) { low += e.low * (it.qty ?? 1); high += e.high * (it.qty ?? 1); }
    }
    return { workshop_address: (ws?.address as string | undefined) ?? null, expected: { low: Math.round(low), high: Math.round(high) } };
  };
  app.get('/api/recycler/bids', async (req) => bidsFor(db, actor(req, ['recycler']).id));
  app.get('/api/market/lots', async (req) => {
    const u = actor(req, ['recycler']);
    const rows = db.prepare("SELECT * FROM lot WHERE status = 'listed' ORDER BY rowid DESC").all() as Row[];
    return rows.map((r) => ({
      ...lotView(db, r),
      ...lotContext(r),
      top_bid: (offersFor(db, r.id)[0]?.amount as number | undefined) ?? null,
      my_bid: (db.prepare("SELECT amount FROM bid WHERE lot_id = ? AND recycler_id = ? AND status = 'open' ORDER BY rowid DESC").get(r.id, u.id) as Row | undefined)?.amount ?? null,
    }));
  });
  app.post<{ Params: { id: string } }>('/api/lots/:id/bids', async (req) => {
    const u = actor(req, ['recycler']);
    const b = req.body as { amount: number; pickup_terms?: string; minutes?: number };
    return placeBid(db, { lotId: req.params.id, recyclerId: u.id, amount: Number(b.amount), pickupTerms: b.pickup_terms ?? '', minutes: b.minutes });
  });

  // ---------- repair centre ----------
  app.get('/api/repair/guides', async () => listGuides(db));
  app.get('/api/repair/listings', async () => listListings(db));
  app.post('/api/repair/listings', async (req) => ({ id: upsertListing(db, actor(req, ['repairer']).id, req.body as any) }));
  app.get('/api/repair/mine', async (req) => {
    const u = actor(req, ['repairer']);
    const l = db.prepare('SELECT * FROM repairer_listing WHERE user_id = ?').get(u.id) as Row | undefined;
    if (!l) return { listing: null, jobs: [] };
    return { listing: { ...l, skills: JSON.parse(l.skills) }, jobs: db.prepare('SELECT * FROM repair_job WHERE listing_id = ? ORDER BY rowid DESC').all(l.id) };
  });
  app.post('/api/repair/jobs', async (req) => {
    const u = actor(req, ['repairer']);
    const l = db.prepare('SELECT id FROM repairer_listing WHERE user_id = ?').get(u.id) as Row | undefined;
    if (!l) throw E(400, 'Create your listing first');
    return { id: createJob(db, l.id, (req.body as any)?.before_photo, String((req.body as any)?.note ?? '')) };
  });
  app.post<{ Params: { id: string } }>('/api/repair/jobs/:id/complete', async (req) => {
    const u = actor(req, ['repairer']);
    const j = db.prepare('SELECT l.user_id FROM repair_job j JOIN repairer_listing l ON l.id = j.listing_id WHERE j.id = ?').get(req.params.id) as Row | undefined;
    if (!j || j.user_id !== u.id) throw E(404, 'Job not found');
    completeJob(db, req.params.id, (req.body as any)?.after_photo);
    return { ok: true };
  });

  // ---------- auditor ----------
  app.get('/api/auditor/overview', async (req) => {
    actor(req, ['auditor']);
    const workers = db.prepare("SELECT id FROM user WHERE role = 'worker'").all() as Row[];
    const lots: ReturnType<typeof lotView>[] = [];
    for (const w of workers) {
      const ok = chainStatus(db, w.id);
      for (const r of db.prepare('SELECT * FROM lot WHERE user_id = ?').all(w.id) as Row[]) lots.push(lotView(db, r, ok.get(r.id)));
    }
    lots.sort((a, b) => b.created_at.localeCompare(a.created_at));
    const open = (l: (typeof lots)[number]) => l.flags.some((f) => f.status === 'open');
    const withSteps = lots.filter((l) => l.steps_total > 0);
    return {
      kpis: {
        lots: lots.length, flagged: lots.filter(open).length, held: lots.filter((l) => l.status === 'held').length,
        total_kg: Math.round(lots.reduce((s, l) => s + l.weight_kg, 0) * 10) / 10,
        safety_pct: withSteps.length ? Math.round((100 * withSteps.reduce((s, l) => s + l.steps_done / l.steps_total, 0)) / withSteps.length) : null,
        open_bids: (db.prepare("SELECT COUNT(*) c FROM bid WHERE status = 'open' AND expires_at > ?").get(new Date().toISOString()) as Row).c,
      },
      lots,
    };
  });
  app.get<{ Params: { id: string } }>('/api/auditor/lots/:id', async (req) => {
    actor(req, ['auditor']);
    const l = db.prepare('SELECT * FROM lot WHERE id = ?').get(req.params.id) as Row | undefined;
    if (!l) throw E(404, 'Lot not found');
    const view = lotView(db, l);
    const related: { id: string; worker_name: string; created_at: string; shared: string[] }[] = [];
    for (const o of db.prepare('SELECT * FROM lot WHERE id != ?').all(l.id) as Row[]) {
      const shared = (JSON.parse(o.photo_hashes) as string[]).filter((h) => view.photo_hashes.includes(h));
      if (shared.length) related.push({ id: o.id, worker_name: lotView(db, o).worker_name, created_at: o.created_at, shared });
    }
    return { lot: view, related, offers: offersFor(db, l.id), chain: chainDetail(db, l.user_id).get(l.id) ?? { hash_ok: false, link_ok: false } };
  });
  app.post<{ Params: { id: string } }>('/api/auditor/lots/:id/hold', async (req) => { actor(req, ['auditor']); holdLot(db, req.params.id); return { ok: true }; });
  app.post<{ Params: { id: string } }>('/api/auditor/lots/:id/release', async (req) => { actor(req, ['auditor']); releaseLot(db, req.params.id); return { ok: true }; });
  app.post<{ Params: { id: string } }>('/api/auditor/lots/:id/recheck', async (req) => {
    actor(req, ['auditor']);
    requestRecheck(db, req.params.id, String((req.body as any)?.note ?? ''));
    return { ok: true };
  });
  app.get('/api/auditor/workers', async (req) => {
    actor(req, ['auditor']);
    return (db.prepare("SELECT u.id, u.name, u.phone, w.name AS workshop, (SELECT COUNT(*) FROM lot WHERE user_id = u.id) AS lots, (SELECT COUNT(*) FROM flag f JOIN lot l ON l.id = f.lot_id WHERE l.user_id = u.id AND f.status = 'open') AS open_flags FROM user u LEFT JOIN workshop w ON w.id = u.workshop_id WHERE u.role = 'worker'").all() as Row[]);
  });
  app.get('/api/auditor/recyclers', async (req) => {
    actor(req, ['auditor']);
    return db.prepare("SELECT u.id, u.name, COUNT(b.id) AS bids, COALESCE(SUM(CASE WHEN b.status='accepted' THEN 1 ELSE 0 END),0) AS accepted FROM user u LEFT JOIN bid b ON b.recycler_id = u.id WHERE u.role = 'recycler' GROUP BY u.id").all();
  });
  app.get('/api/auditor/rates', async (req) => {
    actor(req, ['auditor']);
    return { rates: db.prepare('SELECT * FROM rate ORDER BY city, material').all(), stale: staleRates(db, new Date(), 7) };
  });
  app.put('/api/auditor/rates', async (req) => {
    actor(req, ['auditor']);
    const b = req.body as { material: string; city: string; rate_per_kg: number; source?: string };
    setRate(db, b.material, b.city, Number(b.rate_per_kg), b.source?.trim() || 'SAMPLE: auditor edit');
    return { ok: true };
  });

  return app;
}
