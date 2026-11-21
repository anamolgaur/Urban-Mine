// `npm run auditor -- +919876543210 "Priya Sharma"`: pre-create an auditor account for a phone number.
// The person signs in with that number (OTP) and the account attaches itself. Auditors cannot sign themselves up.
import { randomUUID } from 'node:crypto';
import { openDb } from './db.ts';
import { e164 } from './auth.ts';

const [rawPhone, ...nameParts] = process.argv.slice(2);
const phone = e164(rawPhone);
const name = nameParts.join(' ').trim();
if (!phone || name.length < 2) {
  console.error('Usage: npm run auditor -- +91XXXXXXXXXX "Full name"');
  process.exit(1);
}
const url = process.env.DATABASE_URL;
const db = await openDb(url ? { url } : { dataDir: process.env.PGLITE_DIR ?? '.data/urban-mine' });
const existing = await db.prepare('SELECT role FROM app_user WHERE phone = ?').get(phone);
if (existing) {
  console.error(`An account with this phone number already exists (role: ${existing.role}). Nothing changed.`);
  process.exit(1);
}
const now = new Date().toISOString();
await db.prepare('INSERT INTO app_user (id, role, name, phone, language, workshop_id, approval, kyc_status, created_at) VALUES (?,?,?,?,?,?,?,?,?)')
  .run('u-auditor-' + randomUUID().slice(0, 8), 'auditor', name, phone, 'en', null, 'approved', 'simulated', now);
console.log(`Auditor account created for ${phone.slice(0, 3)}******${phone.slice(-2)}. They can now sign in with that number.`);
await db.close();
