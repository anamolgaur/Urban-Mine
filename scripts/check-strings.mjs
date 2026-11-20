// Checks that every translation key used in the web app exists, and has non-empty English and Hindi text.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const root = new URL('../web/src', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const files = []
const walk = (d) => { for (const f of readdirSync(d)) { const p = join(d, f); statSync(p).isDirectory() ? walk(p) : /\.(tsx?|ts)$/.test(f) && files.push(p) } }
walk(root)

const src = files.filter((f) => !f.endsWith('strings.ts')).map((f) => readFileSync(f, 'utf8')).join('\n')
const strings = readFileSync(join(root, 'lib/strings.ts'), 'utf8')
const defined = new Set([...strings.matchAll(/^\s*'?([A-Za-z_.]+)'?:\s*\[/gm)].map((m) => m[1]))

const used = new Set()
for (const m of src.matchAll(/\bt\(\s*'([^']+)'/g)) used.add(m[1])
// keys stored in arrays/objects and later passed to t(): any quoted token with a known key prefix
for (const m of src.matchAll(/'((?:step|tab|aud|col|shot|cmp|kpi|filter|label|gear)_[a-z_]+)'/g)) used.add(m[1])
// dynamic prefixes
for (const [prefix, vals] of Object.entries({
  'type.': ['phone', 'laptop', 'tablet', 'charger', 'crt_monitor', 'lcd_monitor', 'router', 'set_top_box'],
  'mat.': ['copper', 'aluminium', 'steel', 'plastic', 'glass', 'pcb', 'battery_li'],
  'flag.': ['duplicate_photo', 'weight_outlier', 'gps_far', 'low_safety', 'rapid_repeat', 'recheck_requested'],
  'status.': ['open', 'listed', 'sold', 'held'],
  'diff.': ['easy', 'medium', 'hard'],
  'role.': ['worker', 'recycler', 'repairer', 'auditor'],
})) for (const v of vals) used.add(prefix + v)

const missing = [...used].filter((k) => !/[._]$/.test(k) && !defined.has(k))
const empty = [...strings.matchAll(/'?([A-Za-z_.]+)'?:\s*\[\s*'\s*'|,\s*'\s*'\s*\]/g)]
console.log(`keys defined: ${defined.size}, keys used: ${used.size}`)
console.log(missing.length ? `MISSING: ${missing.join(', ')}` : 'No missing keys.')
if (empty.length) console.log('EMPTY strings found')
process.exit(missing.length ? 1 : 0)
