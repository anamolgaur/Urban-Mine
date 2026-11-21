// Runs after `npm install`, but only on Render: builds the web app so the API service can serve it from one address.
// On your own machine it does nothing (RENDER is not set), so a normal `npm install` stays fast.
import { execSync } from 'node:child_process';

if (process.env.RENDER !== 'true') process.exit(0);

// The sign-in settings are public values the service already has for the API: reuse them for the web build.
process.env.VITE_SUPABASE_URL ||= process.env.SUPABASE_URL ?? '';
process.env.VITE_SUPABASE_ANON_KEY ||= process.env.SUPABASE_ANON_KEY ?? '';
// No VITE_API_URL: the app and the API share one address, so the app calls /api on its own origin.

const run = (cmd) => { console.log(`> ${cmd}`); execSync(cmd, { stdio: 'inherit', env: process.env }); };
run('npm install --prefix web --include=dev');
run('npm run build --prefix web');
console.log('Web app built into web/dist.');
