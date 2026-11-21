// `npm test` runs this first so the slow one-off database template is built once, before the parallel test files start.
import { getTemplate } from './db.ts';
const t = Date.now();
await getTemplate();
console.log(`PGlite template ready (${Date.now() - t} ms)`);
