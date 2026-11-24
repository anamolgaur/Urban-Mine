import Fastify, { type FastifyRequest } from 'fastify';
import rateLimit from '@fastify/rate-limit';
import { USERS as DEMO_USERS } from './seed/users.ts';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import { existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Db } from './db.ts';
import type { Identity, TokenVerifier } from './auth.ts';
import { getSafetyPack, listSafetyTypes, isLang, type SafetyPack } from './safety.ts';
import { estimate, getRates, setRate, staleRates } from './price.ts';
import { RESALE, resaleRange, matchResale } from './resale.ts';
import { runScan, saveFeedback } from './scan.ts';
import { StubClassifier, TesseractOcr, type Classifier, type Ocr } from './vision.ts';
import { loadModels } from './matcher.ts';
import { createLot } from './lots.ts';
import { recordFlags } from './fraud.ts';
import { listLot, placeBid, offersFor, bidsFor, acceptBid, rejectBid, holdLot, releaseLot, requestRecheck, ratingsFor, rateRecycler } from './market.ts';
import { receiptData, renderReceiptPdf } from './receipt.ts';
import { repairComparison, listGuides, listListings, upsertListing, createJob, completeJob, updateJob, jobView, GEAR } from './repair.ts';
import { savePhoto, parseDataUrl, sha256 } from './photos.ts';
import { UnavailableAssessor, CONDITION_FACTORS, isGrade, fairVerdict, type ConditionAssessor } from './condition.ts';
import { LocalPhotoStore, sniffImage, type PhotoStore } from './photostore.ts';
import { lotView, lotsFor, chainStatus, chainDetail } from './views.ts';
import { offensive } from './moderation.ts';
import { isDemoId, resetDemo, DEMO_ACCOUNTS } from './demoaccounts.ts';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

type Row = Record<string, any>;
export type AppDeps = { classifier?: Classifier; ocr?: Ocr; uploadsDir?: string; /** Where photos live. Defaults to local disk in uploadsDir. */ photos?: PhotoStore; /** Photo-based condition grading. Defaults to none (the photo check says it is not available). */ assessor?: ConditionAssessor; /** Photo checks per person per day. */ visionDailyLimit?: number; /** A built web app (web/dist) to serve from this same server, so one service hosts both. Ignored if it has no index.html. */ webDir?: string; /** Checks sign-in tokens (Supabase). */ verifier?: TokenVerifier; /** Accept the X-User-Id header as identity (demo and tests only). Defaults to on when there is no verifier. */ demoLogin?: boolean; /** Allowed web origins (CORS). Omit to allow any origin (dev). */ corsOrigin?: string[]; /** Refuse cross-site browser calls when no corsOrigin is given (production, one service). */ sameOriginOnly?: boolean; /** Requests per minute per address. */ rateLimit?: number; /** Requests that change data, per minute per address. Default 60. */ writeLimit?: number; /** Let anyone open the guided Demo mode without an account (signed guest passes for the demo accounts only). */ guestDemo?: boolean; /** Key that signs guest passes. Random per start if not given. */ guestSecret?: string; /** Deletes a sign-in account (Supabase Auth admin). Used when an auditor removes an account. */ authAdmin?: { deleteUser(authId: string): Promise<void> } };

const E = (statusCode: number, message: string, code?: string) => Object.assign(new Error(message), { statusCode, appCode: code });
const LANGS = ['hi', 'en', 'bn', 'ta', 'te', 'mr', 'gu'];
const HASH = /^[0-9a-f]{64}$/;
const cityOf = (address?: string | null) => (address ?? '').split(',').pop()?.trim() || 'Delhi';

export async function buildApp(db: Db, deps: AppDeps = {}) {
  const assessor: ConditionAssessor = deps.assessor ?? new UnavailableAssessor();
  const visionLimit = deps.visionDailyLimit ?? 20;
  const photos = deps.photos ?? new LocalPhotoStore(resolve(deps.uploadsDir ?? 'uploads'), process.env.PHOTO_URL_SECRET);
  const classifier = deps.classifier ?? new StubClassifier();
  const realOcr = deps.ocr ?? new TesseractOcr();

  const app = Fastify({ bodyLimit: 25 * 1024 * 1024 });
  await app.register(cors, { origin: deps.corsOrigin?.length ? deps.corsOrigin : (deps.sameOriginOnly ? false : true) });
  // Limit requests per address, so one person or script cannot flood the server. Generous for real use.
  /**
   * Who is asking, for rate limits. On Render every request arrives through Cloudflare and Render's own proxy, so req.ip is a
   * proxy's address, the same for every visitor: limits keyed on it were shared by EVERYONE at once. Cloudflare puts the real
   * visitor address in cf-connecting-ip and overwrites any value a visitor sends, so it cannot be faked through onrender.com.
   * Locally and in tests there is no such header, and req.ip is the real caller.
   */
  const clientKey = (req: { headers: Record<string, unknown>; ip: string }) => {
    const cf = req.headers['cf-connecting-ip'];
    return typeof cf === 'string' && cf.length > 0 && cf.length < 64 ? cf : req.ip;
  };
  await app.register(rateLimit, { max: deps.rateLimit ?? 600, timeWindow: '1 minute', keyGenerator: clientKey, allowList: (req) => req.url === '/api/health' });
  /**
   * A tighter limit only for requests that CHANGE something (POST, PUT, PATCH, DELETE): bids, offers, lots, sign-ups, removals.
   * Reading screens stays fast; spamming bids or sign-ups from one address stops after this many per minute.
   * Kept in memory: it resets when the server restarts, which is fine for stopping bursts.
   */
  const writeMax = deps.writeLimit ?? 60;
  const writes = new Map<string, number[]>();
  app.addHook('onRequest', async (req, reply) => {
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return;
    const key = clientKey(req), now = Date.now();
    const recent = (writes.get(key) ?? []).filter((t) => now - t < 60_000);
    if (recent.length >= writeMax) {
      reply.code(429).header('retry-after', '60').send({ error: 'Too many changes in a minute. Please wait a moment and try again.', code: 'too_many_writes' });
      return reply;
    }
    recent.push(now); writes.set(key, recent);
    if (writes.size > 10_000) for (const [k, v] of writes) if (now - v[v.length - 1] > 60_000) writes.delete(k); // forget idle addresses
  });
  // Browser safety headers on every response.
  app.addHook('onSend', async (_req, reply, payload) => {
    reply.header('x-content-type-options', 'nosniff');
    reply.header('x-frame-options', 'DENY');
    reply.header('referrer-policy', 'strict-origin-when-cross-origin');
    reply.header('permissions-policy', 'camera=(self), geolocation=(self), microphone=()');
    if (process.env.NODE_ENV === 'production') reply.header('strict-transport-security', 'max-age=31536000');
    return payload;
  });
  // Errors we raise on purpose carry a status and a plain message. Anything else is unexpected: log it and show a
  // general message, so database or code details never reach the user.
  app.setErrorHandler((err: any, req, reply) => {
    if (err.statusCode && err.statusCode < 500 && err.message) {
      return reply.code(err.statusCode).send({ error: err.message, ...(err.appCode ? { code: err.appCode } : {}) });
    }
    if (err.statusCode === 503 || err.appCode) return reply.code(err.statusCode ?? 500).send({ error: err.message, ...(err.appCode ? { code: err.appCode } : {}) });
    // database errors carry a SQLSTATE code or a severity; never show those
    const fromDb = err.severity !== undefined || (typeof err.code === 'string' && /^[0-9A-Z]{5}$/.test(err.code)) || /sql|relation|column|syntax|ECONN|encoding|duplicate key|violates/i.test(err.message ?? '')
    if (!err.statusCode && err.message && !fromDb) {
      return reply.code(400).send({ error: err.message });
    }
    req.log.error(err);
    return reply.code(500).send({ error: 'Something went wrong. Please try again.' });
  });

  /** With no verifier configured the demo header is the only identity there is; with one, it is off unless demoLogin is set. */
  const demo = deps.demoLogin ?? !deps.verifier;

  /** An app account for a signed-in identity. A pre-provisioned account (e.g. the auditor) with the same phone number attaches itself on first sign-in. */
  const userForIdentity = async (id: Identity): Promise<Row | null> => {
    const u = await db.prepare('SELECT * FROM app_user WHERE auth_id = ?').get(id.sub) as Row | undefined;
    if (u) return u;
    // Only accounts made on purpose (e.g. with `npm run auditor`) can be claimed; the demo people never can.
    const notDemo = `AND id NOT IN (${DEMO_USERS.map(() => '?').join(',')})`;
    const demoIds = DEMO_USERS.map((u) => u.id);
    if (id.phone) {
      const byPhone = await db.prepare(`UPDATE app_user SET auth_id = ? WHERE phone = ? AND auth_id IS NULL ${notDemo} RETURNING *`).get(id.sub, id.phone, ...demoIds) as Row | undefined;
      if (byPhone) return byPhone;
    }
    if (id.email) return (await db.prepare(`UPDATE app_user SET auth_id = ? WHERE email = ? AND auth_id IS NULL ${notDemo} RETURNING *`).get(id.sub, id.email, ...demoIds) as Row | undefined) ?? null;
    return null;
  };

  /** Who is calling: the account (null if signed in but not set up yet) and the sign-in identity. */
  /**
   * Guest passes for the guided Demo mode on the sign-in screen: anyone can try the app as a demo account without a password.
   * A pass is "<account id>.<expiry ms>.<signature>", signed with a server-only key (HMAC-SHA256), so it cannot be forged or
   * pointed at a real account: it is only accepted for the shared demo accounts, and only until it expires (2 hours).
   */
  const guestKey = deps.guestSecret ?? randomBytes(32).toString('hex');
  const signGuest = (id: string, exp: number) => createHmac('sha256', guestKey).update(`${id}.${exp}`).digest('base64url');
  const guestPass = (id: string) => { const exp = Date.now() + 2 * 3600_000; return { token: `${id}.${exp}.${signGuest(id, exp)}`, expires_at: new Date(exp).toISOString() }; };
  const readGuest = (token: string): string | null => {
    const m = /^([a-z0-9-]+)\.(\d{10,16})\.([A-Za-z0-9_-]{20,})$/.exec(token);
    if (!m) return null;
    const [, id, exp, sig] = m;
    const want = Buffer.from(signGuest(id, Number(exp))), got = Buffer.from(sig);
    if (want.length !== got.length || !timingSafeEqual(want, got)) return null; // wrong signature: forged or from an old server key
    if (Number(exp) < Date.now() || !isDemoId(id)) return null;                  // expired, or not a demo account
    return id;
  };

  const whoIs = async (req: FastifyRequest): Promise<{ user: Row | null; id: Identity | null }> => {
    const guest = String(req.headers['x-demo-guest'] ?? '');
    if (guest && deps.guestDemo) {
      const gid = readGuest(guest);
      if (!gid) throw E(401, 'The demo pass has expired. Start the demo again.', 'guest_expired');
      return { user: (await db.prepare('SELECT * FROM app_user WHERE id = ?').get(gid) as Row | undefined) ?? null, id: null };
    }
    const demoId = demo ? String(req.headers['x-user-id'] ?? '') : '';
    if (demoId) {
      const u = await db.prepare('SELECT * FROM app_user WHERE id = ?').get(demoId) as Row | undefined;
      if (!u) throw E(401, 'Unknown user');
      return { user: u, id: null };
    }
    const h = String(req.headers.authorization ?? '');
    if (!deps.verifier || !h.startsWith('Bearer ')) throw E(401, 'Please sign in', 'unauthenticated');
    const id = await deps.verifier.verify(h.slice(7));
    return { user: await userForIdentity(id), id };
  };

  const actor = async (req: FastifyRequest, roles?: string[], opts: { allowPending?: boolean } = {}): Promise<Row> => {
    const { user: u } = await whoIs(req);
    if (!u) throw E(403, 'Finish setting up your account', 'needs_onboarding');
    if (roles && !roles.includes(u.role)) throw E(403, 'Not allowed for this role');
    if (!opts.allowPending && u.approval !== 'approved') throw E(403, u.approval === 'rejected' ? 'Your account was not approved' : 'Your account is waiting for approval', u.approval === 'rejected' ? 'rejected' : 'pending_approval');
    return u;
  };
  /**
   * Demo and real data never mix. The demo accounts are shared by everyone trying the app, so:
   *  - demo buyers only see and bid on demo workers' lots, and real buyers never see demo lots;
   *  - demo workers only see the demo repairer;
   *  - a demo auditor only sees and acts on demo accounts, and cannot change the real rate table or safety guides.
   * Real auditors (the programme team) still see everything, demo accounts included.
   */
  // The demo and real "worlds" are kept apart only when the demo accounts exist (guestDemo on, as in production).
  // With the demo off (local tests, DEMO_ACCOUNTS=0) the sample ids are ordinary accounts and nothing is filtered.
  const worlds = !!deps.guestDemo;
  const sameWorld = (a: unknown, b: unknown) => !worlds || isDemoId(a) === isDemoId(b);
  const DEMO_IN = `(${DEMO_ACCOUNTS.map((a) => `'${a.id}'`).join(',')})`; // fixed ids from code, never user input
  const demoAuditor = (u: Row) => worlds && u.role === 'auditor' && isDemoId(u.id);
  /** For a demo auditor, 404 on anything outside the demo; real auditors pass. */
  const auditorMay = (u: Row, ownerId: unknown) => { if (demoAuditor(u) && !isDemoId(ownerId)) throw E(404, 'Not found'); };
  const noDemoEdits = (u: Row) => { if (demoAuditor(u)) throw E(403, 'Demo auditors can look at this but not change it.', 'demo_readonly'); };

  const lotOwned = async (id: string, userId: string): Promise<Row> => {
    const l = await db.prepare('SELECT * FROM lot WHERE id = ?').get(id) as Row | undefined;
    if (!l || l.user_id !== userId) throw E(404, 'Lot not found');
    return l;
  };

  const webDir = deps.webDir && existsSync(join(resolve(deps.webDir), 'index.html')) ? resolve(deps.webDir) : null;
  if (!webDir) app.get('/', async () => ({ name: 'Urban Mine API', note: 'ALL DATA IS SAMPLE', try: '/api/safety/phone?lang=hi' }));
  // Android app link: proves the Urban Mine APK (signed with this key) belongs to this site, so it opens full screen with no browser bar.
  // The fingerprint is public by design. Change it only if the APK is re-signed with a new key.
  const APK_SHA256 = process.env.APK_SHA256 ?? '3A:FB:E6:42:A6:C7:12:EC:E7:22:93:39:73:24:A4:E0:A8:BE:ED:60:07:D6:DC:0A:93:74:9F:9F:6F:74:FC:FB';
  app.get('/.well-known/assetlinks.json', async (_req, reply) => {
    reply.header('cache-control', 'public, max-age=3600');
    return [{ relation: ['delegate_permission/common.handle_all_urls'], target: { namespace: 'android_app', package_name: 'com.urbanmine.app', sha256_cert_fingerprints: APK_SHA256.split(',').map((s) => s.trim()) } }];
  });
  app.get('/api/health', async () => ({ ok: true }));

  // ---------- identity (mocked) ----------
  app.get('/api/users', async () => !demo ? [] : await db.prepare('SELECT id, role, name, language FROM app_user ORDER BY role, id').all());
  app.get('/api/me', async (req) => {
    const { user: u, id } = await whoIs(req);
    // signed in, but no account yet: the app should run onboarding
    if (!u) return { user: null, needs_onboarding: true, phone: id?.phone ?? null, email: id?.email ?? null };
    const w = u.workshop_id ? (await db.prepare('SELECT * FROM workshop WHERE id = ?').get(u.workshop_id) as Row) : null;
    const { auth_id: _a, ...user } = u;
    return { user, workshop: w, city: cityOf(w?.address), demo: isDemoId(u.id) };
  });
  app.get('/api/cities', async () => ((await db.prepare('SELECT DISTINCT city FROM rate ORDER BY city').all()) as Row[]).map((r) => r.city as string));
  /** First-time account setup, after OTP sign-in. The role is chosen here once and cannot be changed later. */
  app.post('/api/onboarding', async (req) => {
    const { user: existing, id } = await whoIs(req);
    if (!id) throw E(400, 'Onboarding needs a signed-in account');
    if (existing) throw E(409, 'Your account is already set up');
    const b = (req.body ?? {}) as Row;
    if (!['worker', 'recycler', 'repairer'].includes(b.role)) throw E(400, 'Choose worker, recycler or repairer');
    const name = String(b.name ?? '').trim();
    if (name.length < 2 || name.length > 60) throw E(400, 'Enter a name between 2 and 60 characters');
    if (await isBanned(id.phone, id.email)) throw E(403, 'This phone number or email cannot be used to make an account.', 'banned');
    if (offensive(name) || offensive(b.workshop_name) || offensive(b.address)) throw E(400, 'Please use your real name and workshop details. Offensive words are not allowed.', 'offensive_name');
    const language = LANGS.includes(b.language) ? b.language : 'hi';
    if (b.consent !== true) throw E(400, 'You need to accept the privacy notice');
    const now = new Date().toISOString();
    let workshopId: string | null = null;
    if (b.role !== 'recycler') {
      const address = String(b.address ?? '').trim();
      const city = String(b.city ?? '').trim();
      if (address.length < 3 || address.length > 200) throw E(400, 'Enter your workshop address');
      const cities = ((await db.prepare('SELECT DISTINCT city FROM rate').all()) as Row[]).map((r) => r.city);
      if (!cities.includes(city)) throw E(400, 'Choose a city from the list');
      const lat = Number(b.lat), lng = Number(b.lng);
      const hasGps = b.lat != null && b.lng != null && Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
      workshopId = 'ws-' + randomUUID();
      await db.prepare('INSERT INTO workshop VALUES (?,?,?,?,?)').run(workshopId, String(b.workshop_name ?? '').trim().slice(0, 80) || `${name} workshop`, `${address}, ${city}`, hasGps ? lat : null, hasGps ? lng : null);
    }
    const userId = 'u-' + randomUUID();
    // workers start approved; recyclers and repairers wait for an auditor
    await db.prepare('INSERT INTO app_user (id, role, name, phone, email, language, workshop_id, auth_id, approval, kyc_status, consented_at, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
      .run(userId, b.role, name, id.phone, id.email ?? null, language, workshopId, id.sub, b.role === 'worker' ? 'approved' : 'pending', 'simulated', now, now);
    return { id: userId, role: b.role, approval: b.role === 'worker' ? 'approved' : 'pending' };
  });
  /** Delete everything a person made (lots, scans, photos, repair jobs) and blank their account. The row stays, so past sales still add up. */
  const wipeUser = async (userId: string, label: string): Promise<number> => {
    // remember this user's photo hashes so the image files can be removed after the rows are gone
    const hashes = new Set<string>();
    for (const r of await db.prepare('SELECT photo_hashes FROM lot WHERE user_id = ?').all(userId) as Row[]) for (const h of JSON.parse(r.photo_hashes)) hashes.add(h);
    for (const r of await db.prepare('SELECT photos FROM scan WHERE user_id = ?').all(userId) as Row[]) for (const h of JSON.parse(r.photos)) hashes.add(h);
    for (const r of await db.prepare('SELECT hash FROM photo_upload WHERE user_id = ?').all(userId) as Row[]) hashes.add(r.hash);
    for (const r of await db.prepare('SELECT j.before_photo b, j.after_photo a FROM repair_job j JOIN repairer_listing l ON l.id = j.listing_id WHERE l.user_id = ?').all(userId) as Row[]) { if (r.b) hashes.add(r.b); if (r.a) hashes.add(r.a); }
    await db.tx(async (t) => {
      const lots =(await t.prepare('SELECT id FROM lot WHERE user_id = ?').all(userId) as Row[]).map((l) => l.id);
      for (const id of lots) { await t.prepare('DELETE FROM bid WHERE lot_id = ?').run(id); await t.prepare('DELETE FROM flag WHERE lot_id = ?').run(id); }
      await t.prepare('DELETE FROM feedback WHERE scan_id IN (SELECT id FROM scan WHERE user_id = ?)').run(userId);
      await t.prepare('DELETE FROM scan WHERE user_id = ?').run(userId);
      await t.prepare('DELETE FROM lot WHERE user_id = ?').run(userId);
      await t.prepare('DELETE FROM repair_job WHERE listing_id IN (SELECT id FROM repairer_listing WHERE user_id = ?)').run(userId);
      await t.prepare('DELETE FROM repairer_listing WHERE user_id = ?').run(userId);
      await t.prepare('DELETE FROM photo_upload WHERE user_id = ?').run(userId);
      await t.prepare('DELETE FROM vision_usage WHERE user_id = ?').run(userId);
      await t.prepare("UPDATE app_user SET name = ?, phone = NULL, email = NULL, auth_id = NULL, vision_consent_at = NULL WHERE id = ?").run(label, userId);
    });
    for (const h of hashes) {
      if (!HASH.test(h)) continue;
      // keep the file if anyone else still uses these exact bytes
      const shared = await db.prepare('SELECT 1 FROM lot WHERE photo_hashes LIKE ? UNION SELECT 1 FROM scan WHERE photos LIKE ? UNION SELECT 1 FROM repair_job WHERE before_photo = ? OR after_photo = ? UNION SELECT 1 FROM photo_upload WHERE hash = ?')
        .get(`%"${h}"%`, `%"${h}"%`, h, h, h);
      if (!shared) { try { await photos.remove(h); } catch { /* already gone, or storage unreachable: the rows are deleted either way */ } }
    }
    return hashes.size;
  };
  app.delete('/api/me/data', async (req) => {
    const u = await actor(req, undefined, { allowPending: true });
    return { deleted: true, photos_removed: await wipeUser(u.id, 'Deleted user') };
  });
  const isBanned = async (phone: string | null | undefined, email: string | null | undefined): Promise<boolean> => {
    const digits = String(phone ?? '').replace(/\D/g, '');
    if (digits && await db.prepare("SELECT 1 FROM banned_identity WHERE kind = 'phone' AND value = ?").get(digits)) return true;
    if (email && await db.prepare("SELECT 1 FROM banned_identity WHERE kind = 'email' AND value = ?").get(String(email).toLowerCase())) return true;
    return false;
  };

  // ---------- reference data ----------
  app.get('/api/models', async () => await loadModels(db));
  app.get<{ Querystring: { type?: string } }>('/api/resale', async (req) => RESALE.filter((m) => !req.query.type || m.type === req.query.type));
  app.get<{ Querystring: { city?: string } }>('/api/rates', async (req) => await getRates(db, req.query.city ?? 'Delhi'));
  /** Daily rate per material for the last N days (default 30), oldest first: powers the trend lines. */
  app.get<{ Querystring: { city?: string; days?: string } }>('/api/rates/history', async (req) => {
    const days = Math.min(90, Math.max(2, Number(req.query.days) || 30));
    const since = new Date(Date.now() - days * 86400_000).toISOString().slice(0, 10);
    const rows = await db.prepare('SELECT material, day, rate_per_kg FROM rate_history WHERE city = ? AND day >= ? ORDER BY day').all(req.query.city ?? 'Delhi', since) as Row[];
    const out: Record<string, { day: string; rate: number }[]> = {};
    for (const r of rows) (out[r.material] ??= []).push({ day: r.day, rate: r.rate_per_kg });
    return out;
  });
  app.get<{ Querystring: { city?: string; modelId?: string; type?: string } }>('/api/estimate', async (req) => {
    const city = req.query.city ?? 'Delhi';
    const grade = (req.query as Row).grade;
    if (grade !== undefined && !isGrade(grade)) throw E(400, 'grade must be A, B, C or D');
    const q = req.query as Row;
    // A WORKING device is priced by what it sells for second-hand, not by its scrap metal.
    if (q.works === 'true') {
      const r = resaleRange({ resaleId: q.resaleId, condition: q.condition, custom: q.custom ? Number(q.custom) : null });
      if (r) return { lines: [], total: r.total, low: r.low, high: r.high, basis: 'resale', sample: true, weight_kg: ({ phone: 0.2, tablet: 0.5, laptop: 2, charger: 0.12, lcd_monitor: 3.5, crt_monitor: 11, router: 0.3, set_top_box: 0.4 } as Row)[String(q.type)] ?? 0.5, resale: { model: r.model, condition: r.condition }, rates: await getRates(db, city) };
    }
    const est = await estimate(db, city, { modelId: req.query.modelId, type: req.query.type, grade });
    if (!est) throw E(404, 'No composition data for this device');
    return { ...est, rates: await getRates(db, city) };
  });
  app.get<{ Querystring: { city?: string; type?: string; modelId?: string; works?: string } }>('/api/repair/decision', async (req) => {
    const r = await repairComparison(db, req.query.city ?? 'Delhi', { type: String(req.query.type), modelId: req.query.modelId, works: req.query.works === 'true' });
    if (!r) throw E(404, 'No repair data for this device');
    return r;
  });

  // ---------- photos & scan ----------
  const PHOTO_URL_TTL = 600; // seconds
  const recordUploads = async (userId: string, hashes: string[]) => {
    for (const h of new Set(hashes)) await db.prepare('INSERT INTO photo_upload VALUES (?,?,?) ON CONFLICT DO NOTHING').run(h, userId, new Date().toISOString());
  };
  /** Which of these photos this person may see: their own, a lot on sale or sold for an approved recycler, anything for an auditor. */
  const viewable = async (u: Row, hashes: string[]): Promise<Set<string>> => {
    const ok = new Set<string>();
    for (const h of hashes) {
      if (!HASH.test(h)) continue;
      const like = `%"${h}"%`;
      let allowed: boolean;
      if (u.role === 'auditor') allowed = true;
      else if (u.role === 'recycler') allowed = !!(await db.prepare("SELECT 1 FROM lot WHERE status IN ('listed','sold') AND photo_hashes LIKE ?").get(like));
      else allowed = !!(await db.prepare(
        'SELECT 1 FROM photo_upload WHERE hash = ? AND user_id = ? UNION SELECT 1 FROM lot WHERE user_id = ? AND photo_hashes LIKE ? UNION SELECT 1 FROM scan WHERE user_id = ? AND photos LIKE ? '
        + 'UNION SELECT 1 FROM repair_job j JOIN repairer_listing l ON l.id = j.listing_id WHERE l.user_id = ? AND (j.before_photo = ? OR j.after_photo = ?)',
      ).get(h, u.id, u.id, like, u.id, like, u.id, h, h));
      if (allowed) ok.add(h);
    }
    return ok;
  };

  app.post('/api/photos', async (req) => {
    const u = await actor(req);
    const hash = await savePhoto(photos, (req.body as any)?.dataUrl);
    await recordUploads(u.id, [hash]);
    return { hash };
  });
  /** Short-lived links for photos this person may see. A photo they may not see comes back as null, the same as one that does not exist. */
  app.post('/api/photos/urls', async (req) => {
    const u = await actor(req);
    const hashes = (req.body as Row | undefined)?.hashes;
    if (!Array.isArray(hashes) || hashes.length > 50 || !hashes.every((h) => typeof h === 'string')) throw E(400, 'hashes must be a list of up to 50 photo ids');
    const unique = [...new Set(hashes as string[])];
    const ok = await viewable(u, unique);
    const out: Record<string, string | null> = {};
    for (const h of unique) out[h] = ok.has(h) ? await photos.signedUrl(h, PHOTO_URL_TTL) : null;
    return out;
  });
  /** Local store only: serves bytes for a valid, unexpired, signed link. (Supabase hands out its own signed links.) */
  app.get<{ Params: { hash: string }; Querystring: { exp?: string; sig?: string } }>('/api/photos/:hash/file', async (req, reply) => {
    if (!photos.read || !photos.verify || !photos.verify(req.params.hash, Number(req.query.exp), String(req.query.sig ?? ''))) throw E(403, 'This photo link is invalid or has expired');
    const bytes = await photos.read(req.params.hash);
    if (!bytes) throw E(404, 'Photo not found');
    return reply.header('content-type', sniffImage(bytes) ?? 'application/octet-stream').header('cache-control', 'private, max-age=300').header('x-content-type-options', 'nosniff').send(bytes);
  });

  // ---------- photo check (condition grade) ----------
  const usedToday = async (userId: string) => ((await db.prepare('SELECT n FROM vision_usage WHERE user_id = ? AND day = ?').get(userId, new Date().toISOString().slice(0, 10))) as Row | undefined)?.n ?? 0;
  app.get('/api/vision', async (req) => {
    const u = await actor(req, ['worker']);
    return { enabled: assessor.available, consent: !!u.vision_consent_at, daily_limit: visionLimit, used_today: await usedToday(u.id) };
  });
  /** The worker agrees (or withdraws) that photos of devices may be sent to an AI service for the condition check. */
  app.post('/api/vision/consent', async (req) => {
    const u = await actor(req, ['worker']);
    const accepted = (req.body as Row | undefined)?.accepted;
    if (typeof accepted !== 'boolean') throw E(400, 'accepted must be true or false');
    await db.prepare('UPDATE app_user SET vision_consent_at = ? WHERE id = ?').run(accepted ? new Date().toISOString() : null, u.id);
    return { consent: accepted };
  });
  app.post('/api/assess', async (req) => {
    const u = await actor(req, ['worker']);
    if (!assessor.available) return { available: false };
    if (!u.vision_consent_at) throw E(403, 'The photo check needs your permission first', 'vision_consent_required');
    const b = (req.body ?? {}) as Row;
    const hashes: string[] = Array.isArray(b.hashes) ? [...new Set(b.hashes as string[])] : [];
    if (!hashes.length || hashes.length > 4 || !hashes.every((h) => typeof h === 'string' && HASH.test(h))) throw E(400, 'Send 1 to 4 photo ids');
    const type = String(b.type ?? '');
    if (!/^[a-z_]{2,30}$/.test(type)) throw E(400, 'type is required');
    const modelId = b.model_id ? String(b.model_id) : null;
    // only photos this worker is allowed to see
    if ((await viewable(u, hashes)).size !== hashes.length) throw E(403, 'Those photos are not yours');
    const key = sha256(Buffer.from([...hashes].sort().join(',') + `|${type}|${modelId ?? ''}|${assessor.id}`));
    const cached = await db.prepare('SELECT result_json FROM condition_assessment WHERE set_hash = ?').get(key) as Row | undefined;
    const out = (r: Row, fromCache: boolean) => {
      const m = r.model ? matchResale(String(r.model)) : null;
      return { available: true, cached: fromCache, grade: r.grade, issues: r.issues, confidence: r.confidence, factor: CONDITION_FACTORS[r.grade as 'A'], source: 'ai',
        model: r.model ?? null, resale: m ? { id: m.model.id, brand: m.model.brand, model: m.model.model } : null };
    };
    if (cached) return out(JSON.parse(cached.result_json), true);
    if (await usedToday(u.id) >= visionLimit) throw E(429, 'You have used all of today\'s photo checks', 'vision_limit');
    const images: { bytes: Buffer; type: string }[] = [];
    for (const h of hashes) {
      const bytes = photos.read ? await photos.read(h) : null;
      const t = bytes ? sniffImage(bytes) : null;
      if (bytes && t) images.push({ bytes, type: t });
    }
    if (!images.length) return { available: false };
    await db.prepare('INSERT INTO vision_usage VALUES (?,?,1) ON CONFLICT (user_id, day) DO UPDATE SET n = vision_usage.n + 1').run(u.id, new Date().toISOString().slice(0, 10));
    const m = modelId ? await db.prepare('SELECT brand, model FROM device_model WHERE id = ?').get(modelId) as Row | undefined : undefined;
    const r = await assessor.assess({ images, deviceType: type, modelName: m ? `${m.brand} ${m.model}` : null });
    if (!r) return { available: false };
    await db.prepare('INSERT INTO condition_assessment VALUES (?,?,?,?) ON CONFLICT (set_hash) DO NOTHING').run(key, JSON.stringify(r), assessor.id, new Date().toISOString());
    return out(r, false);
  });

  app.post('/api/scan', async (req) => {
    const u = await actor(req, ['worker']);
    const b = req.body as { images?: string[]; hint?: string; ocrText?: string };
    if (!Array.isArray(b?.images) || b.images.length < 1 || b.images.length > 6) throw E(400, '1 to 6 images are required');
    const buffers = b.images.map((i) => parseDataUrl(i).bytes);
    const hashes: string[] = [];
    for (const i of b.images) hashes.push(await savePhoto(photos, i));
    await recordUploads(u.id, hashes);
    // OCR may be slow or offline: never let it block the scan. Typed label text overrides it.
    const scanStarted = Date.now();
    const ocr: Ocr = {
      read: async (img) => {
        if (b.ocrText?.trim()) return b.ocrText;
        // every photo is read now, so keep the whole scan under about 30 seconds
        const left = 30000 - (Date.now() - scanStarted);
        if (left < 3000) return '';
        try { return await Promise.race([realOcr.read(img), new Promise<string>((r) => setTimeout(() => r(''), Math.min(20000, left)))]); } catch { return ''; }
      },
    };
    const res = await runScan(db, { classifier, ocr }, { userId: u.id, images: buffers, photoRefs: hashes, hint: b.hint });
    return { ...res, photoHashes: hashes };
  });
  app.post<{ Params: { id: string } }>('/api/scan/:id/feedback', async (req) => {
    await actor(req, ['worker']);
    const b = req.body as { field: 'type' | 'model' | 'condition'; predicted: string | null; corrected: string | null };
    if (!['type', 'model', 'condition'].includes(b?.field)) throw E(400, 'field must be type, model or condition');
    return { id: await saveFeedback(db, req.params.id, b.field, b.predicted ?? null, b.corrected ?? null) };
  });

  // ---------- safety ----------
  app.get('/api/safety', async () => ({ types: await listSafetyTypes(db) }));
  app.get<{ Params: { type: string }; Querystring: { lang?: string } }>('/api/safety/:type', async (req) => {
    const lang = req.query.lang ?? 'hi';
    if (!isLang(lang)) throw E(400, 'lang must be hi or en');
    const pack = await getSafetyPack(db, req.params.type, lang);
    if (!pack) throw E(404, 'No safety pack for this device type');
    return pack;
  });
  app.put<{ Params: { type: string; lang: string } }>('/api/safety/:type/:lang', async (req) => {
    noDemoEdits(await actor(req, ['auditor']));
    if (!isLang(req.params.lang)) throw E(400, 'lang must be hi or en');
    const cur = await getSafetyPack(db, req.params.type, req.params.lang);
    if (!cur) throw E(404, 'No safety pack');
    const b = req.body as { steps?: { id: string; title?: string; instruction?: string }[]; reviewed_by?: string | null };
    const steps = cur.steps.map((s) => {
      const u = b.steps?.find((x) => x.id === s.id);
      return u ? { ...s, title: u.title?.trim() || s.title, instruction: u.instruction?.trim() || s.instruction } : s;
    });
    const n = Number(cur.version.split('.').pop()) || 0;
    const version = cur.version.replace(/\.\d+$/, '') + '.' + (n + 1);
    const body: Partial<SafetyPack> = { gear: cur.gear, steps, emergency: cur.emergency, draft_banner: cur.draft_banner };
    await db.prepare('UPDATE safety_pack SET steps_json = ?, version = ?, reviewed_by = ? WHERE device_type = ? AND language = ?')
      .run(JSON.stringify(body), version, b.reviewed_by?.trim() || null, req.params.type, req.params.lang);
    return await getSafetyPack(db, req.params.type, req.params.lang);
  });

  // ---------- lots, offers, receipt (worker) ----------
  app.post('/api/lots', async (req) => {
    const u = await actor(req, ['worker']);
    const b = req.body as any;
    if (!Array.isArray(b?.items) || !b.items.length || !b.items.every((i: any) => typeof i.type === 'string' && (i.qty ?? 1) >= 1 && (i.grade === undefined || isGrade(i.grade)))) throw E(400, 'items required');
    // the lot record is permanent: keep only the fields we know
    b.items = b.items.map((i: any) => ({ ...(i.model_id ? { model_id: String(i.model_id) } : {}), type: i.type, ...(i.qty !== undefined ? { qty: i.qty } : {}), ...(i.grade ? { grade: i.grade, grade_source: i.grade_source === 'worker' ? 'worker' : 'ai' } : {}),
      ...(i.works === true ? { works: true, condition: ['good', 'fair', 'poor'].includes(i.condition) ? i.condition : 'good',
        ...(i.resale_id ? { resale_id: String(i.resale_id).slice(0, 40) } : {}), ...(Number(i.custom_price) > 0 && Number(i.custom_price) <= 1_000_000 ? { custom_price: Math.round(Number(i.custom_price)) } : {}) } : {}) }));
    if (!(b.weight_kg > 0) || b.weight_kg > 1000) throw E(400, 'Weight must be between 0 and 1000 kg', 'bad_weight');
    if (!(b.steps_total >= 0) || !(b.steps_done >= 0) || b.steps_done > b.steps_total) throw E(400, 'invalid step counts');
    if (!Array.isArray(b.photo_hashes) || !b.photo_hashes.every((h: string) => HASH.test(h))) throw E(400, 'photo_hashes must be sha-256 hashes');
    const gps = b.gps && Number.isFinite(b.gps.lat) && Number.isFinite(b.gps.lng) ? { lat: b.gps.lat, lng: b.gps.lng } : null;
    const { id } = await createLot(db, { user_id: u.id, items: b.items, weight_kg: b.weight_kg, steps_done: b.steps_done, steps_total: b.steps_total, photo_hashes: b.photo_hashes, gps });
    await recordFlags(db, id);
    return await lotView(db, await db.prepare('SELECT * FROM lot WHERE id = ?').get(id) as Row);
  });
  app.get('/api/lots', async (req) => await lotsFor(db, (await actor(req, ['worker'])).id));
  app.get<{ Params: { id: string } }>('/api/lots/:id', async (req) => {
    const u = await actor(req);
    const l = await db.prepare('SELECT * FROM lot WHERE id = ?').get(req.params.id) as Row | undefined;
    if (!l || (u.role === 'worker' && l.user_id !== u.id)) throw E(404, 'Lot not found');
    const sale = await db.prepare("SELECT b.amount, u.name AS buyer FROM bid b JOIN app_user u ON u.id = b.recycler_id WHERE b.lot_id = ? AND b.status = 'accepted'").get(l.id) as Row | undefined;
    const rated = await db.prepare('SELECT stars, note FROM recycler_rating WHERE lot_id = ?').get(l.id) as Row | undefined;
    return { ...(await lotView(db, l)), sale: sale ? { amount: sale.amount, buyer: sale.buyer } : null, rating: rated ? { stars: rated.stars, note: rated.note } : null };
  });
  // DEMO ONLY: places two sample offers from sample recyclers so the sell flow can be shown without a second device.
  /** Start (or switch role in) the guided Demo mode: no account needed, returns a 2-hour guest pass for that role's demo account. */
  app.post('/api/demo/guest', async (req) => {
    if (!deps.guestDemo) throw E(404, 'Not found');
    const role = String((req.body as Row | undefined)?.role ?? '');
    const id = ({ worker: 'u-worker-1', recycler: 'u-recycler-1', repairer: 'u-repairer-1', auditor: 'u-auditor-1' } as Record<string, string>)[role];
    if (!id) throw E(400, 'role must be worker, recycler, repairer or auditor');
    const u = await db.prepare('SELECT approval FROM app_user WHERE id = ?').get(id) as Row | undefined;
    if (!u) throw E(503, 'The demo is being set up. Try again in a minute.', 'demo_unavailable');
    // someone removed or un-approved a demo account: put the demo back so the next visitor gets a working app
    if (u.approval !== 'approved') await resetDemo(db, photos);
    return { ...guestPass(id), role, user_id: id };
  });
  /** A demo auditor puts every demo account back to the starting sample story (for the next person trying the app). Real accounts are untouched. */
  app.post('/api/demo/reset', async (req) => {
    const u = await actor(req, ['auditor']);
    if (!isDemoId(u.id)) throw E(403, 'Only a demo auditor account can reset the demo');
    await resetDemo(db, photos);
    return { ok: true };
  });
  app.post<{ Params: { id: string } }>('/api/demo/offers/:id', async (req) => {
    const u = await actor(req, ['worker']);
    // the sample buyers only bid on demo lots: in demo-login mode, or for the demo worker accounts on the live app
    if (!demo && !isDemoId(u.id)) throw E(404, 'Not found');
    const l = await lotOwned(req.params.id, u.id);
    if (l.status !== 'listed') throw E(400, 'Lot is not listed');
    const ws = await db.prepare('SELECT w.address FROM workshop w JOIN app_user x ON x.workshop_id = w.id WHERE x.id = ?').get(u.id) as Row | undefined;
    let base = 0;
    for (const it of JSON.parse(l.items) as Row[]) {
      const rs = it.works ? resaleRange({ resaleId: it.resale_id, condition: it.condition, custom: it.custom_price }) : null;
      const e = rs ?? await estimate(db, cityOf(ws?.address), { modelId: it.model_id, type: it.type });
      if (e) base += e.total * (it.qty ?? 1);
    }
    base = Math.max(10, Math.round(base));
    await placeBid(db, { lotId: l.id, recyclerId: 'u-recycler-1', amount: Math.round(base * 1.08), pickupTerms: 'Pickup tomorrow 10am', minutes: 30 });
    await placeBid(db, { lotId: l.id, recyclerId: 'u-recycler-2', amount: Math.round(base * 1.0), pickupTerms: 'Pickup today 6pm', minutes: 15 });
    return await withFair(l, await offersFor(db, l.id));
  });
  app.post<{ Params: { id: string } }>('/api/lots/:id/rating', async (req) => {
    const u = await actor(req, ['worker']);
    const b = (req.body ?? {}) as Row;
    await rateRecycler(db, req.params.id, u.id, Number(b.stars), String(b.note ?? ''));
    return { ok: true };
  });
  app.post<{ Params: { id: string } }>('/api/lots/:id/list', async (req) => {
    const u = await actor(req, ['worker']);
    await lotOwned(req.params.id, u.id);
    await listLot(db, req.params.id, u.id);
    return { ok: true };
  });
  app.get<{ Params: { id: string } }>('/api/lots/:id/offers', async (req) => {
    const u = await actor(req, ['worker']);
    const owned = await lotOwned(req.params.id, u.id);
    return await withFair(owned, await offersFor(db, req.params.id));
  });
  app.post<{ Params: { id: string } }>('/api/bids/:id/accept', async (req) => {
    const u = await actor(req, ['worker']);
    const r = await acceptBid(db, req.params.id, u.id);
    // Mocked UPI payout: no money moves.
    return { ...r, payout: { method: 'UPI (SIMULATED)', status: 'confirmed', reference: 'SIM-' + req.params.id.slice(0, 8).toUpperCase() } };
  });
  app.post<{ Params: { id: string } }>('/api/bids/:id/reject', async (req) => {
    await rejectBid(db, req.params.id, (await actor(req, ['worker'])).id);
    return { ok: true };
  });
  app.get<{ Params: { id: string } }>('/api/lots/:id/receipt.pdf', async (req, reply) => {
    const u = await actor(req, ['worker', 'auditor', 'recycler']);
    const l = await db.prepare('SELECT user_id FROM lot WHERE id = ?').get(req.params.id) as Row | undefined;
    if (!l || (u.role === 'worker' && l.user_id !== u.id)) throw E(404, 'Lot not found');
    const pdf = await renderReceiptPdf(await receiptData(db, req.params.id));
    return reply.header('content-type', 'application/pdf').header('content-disposition', `inline; filename="receipt-${req.params.id.slice(0, 8)}.pdf"`).send(pdf);
  });

  // ---------- recycler ----------
  /** Seller location and a SAMPLE expected value for a lot, so a recycler can judge a bid. */
  const lotContext = async (lotRow: Row) => {
    const ws = await db.prepare('SELECT w.address FROM workshop w JOIN app_user x ON x.workshop_id = w.id WHERE x.id = ?').get(lotRow.user_id) as Row | undefined;
    const city = cityOf(ws?.address);
    let low = 0, high = 0;
    for (const it of JSON.parse(lotRow.items) as Row[]) {
      const rs = it.works ? resaleRange({ resaleId: it.resale_id, condition: it.condition, custom: it.custom_price }) : null;
      const e = rs ?? await estimate(db, city, { modelId: it.model_id, type: it.type, grade: it.grade });
      if (e) { low += e.low * (it.qty ?? 1); high += e.high * (it.qty ?? 1); }
    }
    return { workshop_address: (ws?.address as string | undefined) ?? null, expected: { low: Math.round(low), high: Math.round(high) } };
  };
  /** Each offer, tagged with where it sits against the fair range for this lot (below, within or above). A guide built on SAMPLE rates, not a promise. */
  const withFair = async (lotRow: Row, offers: Row[]) => {
    const { expected } = await lotContext(lotRow);
    const known = expected.high > 0;
    const ratings = await ratingsFor(db, [...new Set(offers.map((o) => o.recycler_id as string))]);
    return offers.map((o) => ({ ...o, rating: ratings[o.recycler_id] ?? null, fair: known ? { verdict: fairVerdict(o.amount, expected.low, expected.high), low: expected.low, high: expected.high } : null }));
  };
  app.get('/api/recycler/bids', async (req) => await bidsFor(db, (await actor(req, ['recycler'])).id));
  app.get('/api/market/lots', async (req) => {
    const u = await actor(req, ['recycler']);
    const rows = (await db.prepare("SELECT * FROM lot WHERE status = 'listed' ORDER BY seq DESC").all() as Row[]).filter((r) => sameWorld(r.user_id, u.id));
    return await Promise.all(rows.map(async (r) => {
      // Buyers see what they need to bid, not where the worker lives: no GPS coordinates and no full address
      // (both point at the worker's home or workshop), only the city and whether a location was recorded.
      // The full lot, with GPS, stays visible to the worker and to auditors.
      const { gps, user_id: _owner, ...lot } = await lotView(db, r);
      const ctx = await lotContext(r);
      return {
      ...lot,
      gps_recorded: !!gps,
      workshop_address: ctx.workshop_address ? cityOf(ctx.workshop_address) : null,
      expected: ctx.expected,
      top_bid: (((await offersFor(db, r.id)) as Row[])[0]?.amount as number | undefined) ?? null,
      my_bid: ((await db.prepare("SELECT amount FROM bid WHERE lot_id = ? AND recycler_id = ? AND status = 'open' ORDER BY seq DESC").get(r.id, u.id)) as Row | undefined)?.amount ?? null,
      };
    }));
  });
  app.post<{ Params: { id: string } }>('/api/lots/:id/bids', async (req) => {
    const u = await actor(req, ['recycler']);
    const b = req.body as { amount: number; pickup_terms?: string; minutes?: number };
    // Protect workers from lowball offers: a bid must reach at least 80% of the lot's fair low estimate.
    const lotRow = await db.prepare('SELECT * FROM lot WHERE id = ?').get(req.params.id) as Row | undefined;
    if (lotRow && !sameWorld(lotRow.user_id, u.id)) throw E(404, 'Lot not found');
    if (lotRow) {
      const floor = Math.round((await lotContext(lotRow)).expected.low * 0.8);
      if (floor > 0 && Number(b.amount) < floor) throw E(400, `Offer too low. The minimum for this lot is Rs ${floor}.`, 'bid_too_low');
    }
    return await placeBid(db, { lotId: req.params.id, recyclerId: u.id, amount: Number(b.amount), pickupTerms: b.pickup_terms ?? '', minutes: b.minutes });
  });

  // ---------- repair centre ----------
  app.get('/api/repair/guides', async () => await listGuides(db));
  app.get('/api/repair/listings', async (req) => {
    let me: unknown = null;
    try { me = (await whoIs(req)).user?.id ?? null; } catch { /* not signed in: show real repairers */ }
    return ((await listListings(db)) as Row[]).filter((l) => sameWorld(l.user_id, me));
  });
  app.post('/api/repair/listings', async (req) => ({ id: await upsertListing(db, (await actor(req, ['repairer'])).id, req.body as any) }));
  app.get('/api/repair/mine', async (req) => {
    const u = await actor(req, ['repairer']);
    const l = await db.prepare('SELECT * FROM repairer_listing WHERE user_id = ?').get(u.id) as Row | undefined;
    if (!l) return { listing: null, jobs: [] };
    return { listing: { ...l, skills: JSON.parse(l.skills) }, jobs: ((await db.prepare('SELECT * FROM repair_job WHERE listing_id = ? ORDER BY seq DESC').all(l.id)) as Row[]).map(jobView) };
  });
  app.post('/api/repair/jobs', async (req) => {
    const u = await actor(req, ['repairer']);
    const l = await db.prepare('SELECT id FROM repairer_listing WHERE user_id = ?').get(u.id) as Row | undefined;
    if (!l) throw E(400, 'Create your listing first');
    const b = (req.body ?? {}) as any;
    return { id: await createJob(db, l.id, b.before_photo, String(b.note ?? ''), new Date(), {
      device_type: typeof b.device_type === 'string' ? b.device_type.slice(0, 30) : undefined,
      guide_id: typeof b.guide_id === 'string' ? b.guide_id.slice(0, 60) : undefined,
      gear: Array.isArray(b.gear) ? b.gear.map(String) : [], requireGear: true }) };
  });
  app.get('/api/repair/gear', async () => GEAR);
  const ownJob = async (req: FastifyRequest, id: string) => {
    const u = await actor(req, ['repairer']);
    const j = await db.prepare('SELECT l.user_id FROM repair_job j JOIN repairer_listing l ON l.id = j.listing_id WHERE j.id = ?').get(id) as Row | undefined;
    if (!j || j.user_id !== u.id) throw E(404, 'Job not found');
  };
  app.post<{ Params: { id: string } }>('/api/repair/jobs/:id/progress', async (req) => {
    await ownJob(req, req.params.id);
    const b = (req.body ?? {}) as any;
    await updateJob(db, req.params.id, { during_photo: typeof b.during_photo === 'string' && HASH.test(b.during_photo) ? b.during_photo : undefined,
      step: b.step !== undefined ? Number(b.step) : undefined, done: b.done, diary: b.diary && typeof b.diary === 'object' ? b.diary : undefined });
    return { ok: true };
  });
  app.post<{ Params: { id: string } }>('/api/repair/jobs/:id/complete', async (req) => {
    const u = await actor(req, ['repairer']);
    const j = await db.prepare('SELECT l.user_id FROM repair_job j JOIN repairer_listing l ON l.id = j.listing_id WHERE j.id = ?').get(req.params.id) as Row | undefined;
    if (!j || j.user_id !== u.id) throw E(404, 'Job not found');
    await completeJob(db, req.params.id, (req.body as any)?.after_photo, new Date(), (req.body as any)?.diary);
    return { ok: true };
  });

  // ---------- auditor ----------
  // CSV for auditors: every lot with its sale. Cells that start with = + - @ are quoted with ' so spreadsheets never run them as formulas.
  app.get('/api/auditor/export.csv', async (req, reply) => {
    const aud = await actor(req, ['auditor']);
    const rows = await db.prepare(`SELECT l.id, l.created_at, w.name AS worker, l.items, l.weight_kg, l.steps_done, l.steps_total, l.status, l.hash,
        r.name AS buyer, b.amount, rr.stars
      FROM lot l JOIN app_user w ON w.id = l.user_id
      LEFT JOIN bid b ON b.lot_id = l.id AND b.status = 'accepted'
      LEFT JOIN app_user r ON r.id = b.recycler_id
      LEFT JOIN recycler_rating rr ON rr.lot_id = l.id
      ${demoAuditor(aud) ? `WHERE l.user_id IN ${DEMO_IN}` : ''}
      ORDER BY l.created_at DESC`).all() as Row[];
    const cell = (v: unknown) => {
      let s = v == null ? '' : String(v);
      if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const items = (j: string) => { try { return (JSON.parse(j) as { type?: string }[]).map((i) => i.type ?? '').join(' + '); } catch { return ''; } };
    const head = ['lot_id', 'date', 'worker', 'items', 'weight_kg', 'safety_steps_done', 'safety_steps_total', 'status', 'buyer', 'paid_inr', 'buyer_rating', 'record_hash'];
    const body = rows.map((r) => [r.id, r.created_at, r.worker, items(r.items), r.weight_kg, r.steps_done, r.steps_total, r.status, r.buyer, r.amount, r.stars, r.hash].map(cell).join(','));
    reply.header('Content-Type', 'text/csv; charset=utf-8').header('Content-Disposition', 'attachment; filename="urban-mine-lots.csv"');
    return '\uFEFF' + [head.join(','), ...body].join('\r\n');
  });
  app.get('/api/auditor/overview', async (req) => {
    const aud = await actor(req, ['auditor']);
    const workers = (await db.prepare("SELECT id FROM app_user WHERE role = 'worker'").all() as Row[]).filter((w) => !demoAuditor(aud) || isDemoId(w.id));
    const lots: Awaited<ReturnType<typeof lotView>>[] = [];
    for (const w of workers) {
      const ok = await chainStatus(db, w.id);
      for (const r of await db.prepare('SELECT * FROM lot WHERE user_id = ?').all(w.id) as Row[]) lots.push(await lotView(db, r, ok.get(r.id)));
    }
    lots.sort((a, b) => b.created_at.localeCompare(a.created_at));
    const open = (l: (typeof lots)[number]) => l.flags.some((f) => f.status === 'open');
    const withSteps = lots.filter((l) => l.steps_total > 0);
    return {
      kpis: {
        lots: lots.length, flagged: lots.filter(open).length, held: lots.filter((l) => l.status === 'held').length,
        total_kg: Math.round(lots.reduce((s, l) => s + l.weight_kg, 0) * 10) / 10,
        safety_pct: withSteps.length ? Math.round((100 * withSteps.reduce((s, l) => s + l.steps_done / l.steps_total, 0)) / withSteps.length) : null,
        open_bids: (await db.prepare(`SELECT COUNT(*) c FROM bid b JOIN lot l ON l.id = b.lot_id WHERE b.status = 'open' AND b.expires_at > ? ${demoAuditor(aud) ? `AND l.user_id IN ${DEMO_IN}` : ''}`).get(new Date().toISOString()) as Row).c,
      },
      lots,
    };
  });
  app.get<{ Params: { id: string } }>('/api/auditor/lots/:id', async (req) => {
    const aud = await actor(req, ['auditor']);
    const l = await db.prepare('SELECT * FROM lot WHERE id = ?').get(req.params.id) as Row | undefined;
    if (!l) throw E(404, 'Lot not found');
    auditorMay(aud, l.user_id);
    const view = await lotView(db, l);
    const related: { id: string; worker_name: string; created_at: string; shared: string[] }[] = [];
    for (const o of (await db.prepare('SELECT * FROM lot WHERE id != ?').all(l.id) as Row[]).filter((o) => !demoAuditor(aud) || isDemoId(o.user_id))) {
      const shared = (JSON.parse(o.photo_hashes) as string[]).filter((h) => view.photo_hashes.includes(h));
      if (shared.length) related.push({ id: o.id, worker_name: (await lotView(db, o)).worker_name, created_at: o.created_at, shared });
    }
    return { lot: view, related, offers: await offersFor(db, l.id), chain: (await chainDetail(db, l.user_id)).get(l.id) ?? { hash_ok: false, link_ok: false } };
  });
  /** The auditor, after checking a demo auditor only touches demo lots. */
  const lotAuditor = async (req: FastifyRequest, lotId: string) => {
    const aud = await actor(req, ['auditor']);
    const l = await db.prepare('SELECT user_id FROM lot WHERE id = ?').get(lotId) as Row | undefined;
    if (l) auditorMay(aud, l.user_id);
    return aud;
  };
  app.post<{ Params: { id: string } }>('/api/auditor/lots/:id/hold', async (req) => { await lotAuditor(req, req.params.id); await holdLot(db, req.params.id); return { ok: true }; });
  app.post<{ Params: { id: string } }>('/api/auditor/lots/:id/release', async (req) => { await lotAuditor(req, req.params.id); await releaseLot(db, req.params.id); return { ok: true }; });
  app.post<{ Params: { id: string } }>('/api/auditor/lots/:id/recheck', async (req) => {
    await lotAuditor(req, req.params.id);
    await requestRecheck(db, req.params.id, String((req.body as any)?.note ?? ''));
    return { ok: true };
  });
  app.get('/api/auditor/workers', async (req) => {
    const aud = await actor(req, ['auditor']);
    const rows = await db.prepare("SELECT u.id, u.name, u.phone, w.name AS workshop, w.address, (SELECT COUNT(*) FROM lot WHERE user_id = u.id) AS lots, (SELECT COUNT(*) FROM flag f JOIN lot l ON l.id = f.lot_id WHERE l.user_id = u.id AND f.status = 'open') AS open_flags FROM app_user u LEFT JOIN workshop w ON w.id = u.workshop_id WHERE u.role = 'worker' AND u.approval <> 'rejected'").all() as Row[];
    return rows.filter((r) => !demoAuditor(aud) || isDemoId(r.id)).map(({ address, ...r }) => ({ ...r, name_flagged: offensive(r.name) || offensive(r.workshop) || offensive(address) }));
  });
  app.get('/api/auditor/recyclers', async (req) => {
    const aud = await actor(req, ['auditor']);
    const rows = await db.prepare("SELECT u.id, u.name, COUNT(b.id) AS bids, COALESCE(SUM(CASE WHEN b.status='accepted' THEN 1 ELSE 0 END),0) AS accepted FROM app_user u LEFT JOIN bid b ON b.recycler_id = u.id WHERE u.role = 'recycler' AND u.approval <> 'rejected' GROUP BY u.id").all() as Row[];
    return rows.filter((r) => !demoAuditor(aud) || isDemoId(r.id)).map((r) => ({ ...r, name_flagged: offensive(r.name) }));
  });
  app.get('/api/auditor/approvals', async (req) => {
    const aud = await actor(req, ['auditor']);
    const rows = await db.prepare("SELECT u.id, u.role, u.name, u.phone, u.approval, u.created_at, w.name AS workshop, w.address FROM app_user u LEFT JOIN workshop w ON w.id = u.workshop_id WHERE u.role IN ('recycler','repairer') AND u.approval <> 'approved' AND u.name <> 'Removed account' ORDER BY u.created_at DESC").all() as Row[];
    return rows.filter((r) => !demoAuditor(aud) || isDemoId(r.id)).map(({ workshop, ...r }) => ({ ...r, name_flagged: offensive(r.name) || offensive(workshop) || offensive(r.address) }));
  });
  /** Remove a fake or abusive account: delete what it made, blank the name and workshop, block its phone and email, and delete its sign-in. */
  app.post<{ Params: { id: string } }>('/api/auditor/users/:id/remove', async (req) => {
    const me = await actor(req, ['auditor']);
    const target = await db.prepare('SELECT * FROM app_user WHERE id = ?').get(req.params.id) as Row | undefined;
    if (!target || !['worker', 'recycler', 'repairer'].includes(target.role)) throw E(404, 'Account not found');
    auditorMay(me, target.id);
    const reason = String((req.body as Row | undefined)?.reason ?? '').trim().slice(0, 200) || null;
    const now = new Date().toISOString();
    // demo accounts are shared by everyone trying the app: removing one blanks it until the next demo reset, but never blocks or deletes its sign-in
    const demoAcct = isDemoId(target.id);
    const digits = demoAcct ? '' : String(target.phone ?? '').replace(/\D/g, '');
    if (digits) await db.prepare("INSERT INTO banned_identity (kind, value, reason, banned_by, created_at) VALUES ('phone', ?, ?, ?, ?) ON CONFLICT DO NOTHING").run(digits, reason, me.id, now);
    if (target.email && !demoAcct) await db.prepare("INSERT INTO banned_identity (kind, value, reason, banned_by, created_at) VALUES ('email', ?, ?, ?, ?) ON CONFLICT DO NOTHING").run(String(target.email).toLowerCase(), reason, me.id, now);
    await db.prepare("UPDATE bid SET status = 'rejected' WHERE recycler_id = ? AND status = 'open'").run(target.id);
    const removed = await wipeUser(target.id, 'Removed account');
    if (demoAcct) await db.prepare('UPDATE app_user SET auth_id = ? WHERE id = ?').run(target.auth_id ?? null, target.id);
    await db.prepare("UPDATE app_user SET approval = 'rejected' WHERE id = ?").run(target.id);
    if (target.workshop_id) await db.prepare("UPDATE workshop SET name = 'Removed', address = '', lat = NULL, lng = NULL WHERE id = ?").run(target.workshop_id);
    if (target.auth_id && deps.authAdmin && !demoAcct) { try { await deps.authAdmin.deleteUser(String(target.auth_id)); } catch { /* the app account is already blank and blocked */ } }
    return { ok: true, photos_removed: removed };
  });
  app.post<{ Params: { id: string } }>('/api/auditor/users/:id/approval', async (req) => {
    auditorMay(await actor(req, ['auditor']), req.params.id);
    const decision = (req.body as Row | undefined)?.decision;
    if (!['approved', 'rejected'].includes(decision)) throw E(400, 'decision must be approved or rejected');
    const r = await db.prepare("UPDATE app_user SET approval = ? WHERE id = ? AND role IN ('recycler','repairer')").run(decision, req.params.id);
    if (!r.changes) throw E(404, 'Recycler or repairer not found');
    return { ok: true };
  });
  app.get('/api/auditor/rates', async (req) => {
    await actor(req, ['auditor']);
    return { rates: await db.prepare('SELECT * FROM rate ORDER BY city, material').all(), stale: await staleRates(db, new Date(), 7) };
  });
  app.put('/api/auditor/rates', async (req) => {
    noDemoEdits(await actor(req, ['auditor']));
    const b = req.body as { material: string; city: string; rate_per_kg: number; source?: string };
    await setRate(db, b.material, b.city, Number(b.rate_per_kg), b.source?.trim() || 'Auditor edit');
    return { ok: true };
  });

  // ---------- the web app, served from here when it has been built ----------
  if (webDir) {
    await app.register(fastifyStatic, {
      root: webDir,
      preCompressed: true, // send the .br/.gz copies made at build time when the browser accepts them
      // the service worker and page shell must always be re-checked, so a new release reaches phones; hashed assets never change
      setHeaders: (res, path) => {
        const p = path.replace(/\\/g, '/');
        // hashed assets, the versioned AI engine and the model file never change in place
        const forever = /\/assets\/|\.onnx$/.test(p);
        res.header('cache-control', forever ? 'public, max-age=31536000, immutable' : 'no-cache');
      },
    });
    // a page address such as /lots belongs to the app: send the shell. An unknown /api address stays a JSON 404.
    app.setNotFoundHandler((req, reply) => {
      const wantsPage = req.method === 'GET' && !req.url.startsWith('/api/') && !req.url.startsWith('/api?') && (req.headers.accept ?? '').includes('text/html');
      if (wantsPage) return reply.sendFile('index.html');
      return reply.code(404).send({ error: 'Not found' });
    });
  }

  return app;
}
