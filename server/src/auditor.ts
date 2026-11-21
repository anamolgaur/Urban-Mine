// `npm run auditor -- you@example.com "Priya Sharma"` or `npm run auditor -- +919876543210 "Priya Sharma"`:
// pre-create an auditor account. The person creates a login with that email or phone, and the account attaches itself
// at first sign-in. Auditors cannot sign themselves up.
import { randomUUID } from 'node:crypto';
import { openDb } from './db.ts';
import { e164, normEmail } from './auth.ts';

const [rawId, ...nameParts] = process.argv.slice(2);
const email = normEmail(rawId);
const phone = email ? null : e164(rawId);
const name = nameParts.join(' ').trim();
if ((!email && !phone) || name.length < 2) {
  console.error('Usage: npm run auditor -- you@example.com "Full name"   (or a +91 phone number)');
  process.exit(1);
}
const url = process.env.DATABASE_URL;
const db = await openDb(url ? { url } : { dataDir: process.env.PGLITE_DIR ?? '.data/urban-mine' });
const existing = await db.prepare(email ? 'SELECT role FROM app_user WHERE email = ?' : 'SELECT role FROM app_user WHERE phone = ?').get(email ?? phone);
if (existing) {
  console.error(`An account with this ${email ? 'email' : 'phone number'} already exists (role: ${existing.role}). Nothing changed.`);
  process.exit(1);
}
const now = new Date().toISOString();
await db.prepare('INSERT INTO app_user (id, role, name, phone, email, language, workshop_id, approval, kyc_status, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)')
  .run('u-auditor-' + randomUUID().slice(0, 8), 'auditor', name, phone, email, 'en', null, 'approved', 'simulated', now);
console.log(`Auditor account created. They can now create a login with that ${email ? 'email' : 'number'} and sign in.`);
await db.close();
