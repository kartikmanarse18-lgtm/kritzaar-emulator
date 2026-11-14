// Validates /data/originals.json (KritZaar's own games). Usage: node scripts/validate-originals.mjs
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const data = JSON.parse(readFileSync(join(root, 'data/originals.json'), 'utf8'));
const COMPAT = ['verified', 'playable', 'issues', 'broken', 'untested'];
const errors = []; const err = (w, m) => errors.push(`${w}: ${m}`);
const seen = new Set();
for (const g of data.games || []) {
  const w = `originals (${g.id})`;
  if (!/^kz-[a-z0-9]+(-[a-z0-9]+)*$/.test(g.id || '')) err(w, 'id must start with "kz-" and use lowercase letters, digits, hyphens');
  if (seen.has(g.id)) err(w, 'duplicate id'); seen.add(g.id);
  if (!g.title) err(w, 'title required');
  if (g.platform !== 'native') err(w, 'platform must be "native"');
  if (g.license !== 'original') err(w, 'license must be "original" (third-party games belong in games.json)');
  if (g.developer !== 'KritZaar') err(w, 'developer must be "KritZaar"');
  if (!/^\/originals\/games\/[a-z0-9-]+\.js$/.test(g.module || '') || !existsSync(join(root, g.module || 'x'))) err(w, 'module must be an existing /originals/games/*.js file');
  if (!/^\/originals\/covers\//.test(g.cover || '') || !existsSync(join(root, g.cover || 'x'))) err(w, 'cover must be an existing file under /originals/covers/');
  if (g.assets) { // asset standard: /assets/games/<id>/ (every file optional, but a flag must not lie)
    const dir = join(root, 'assets/games', g.id);
    if (!existsSync(join(dir, 'cover.webp'))) err(w, 'assets=true needs assets/games/<id>/cover.webp');
    if (g.preview && !(existsSync(join(dir, 'preview.webm')) && existsSync(join(dir, 'preview.mp4')))) err(w, 'preview=true needs preview.webm and preview.mp4');
    for (let n = 1; n <= (g.shots || 0); n++) if (!existsSync(join(dir, 'shots', n + '.webp'))) err(w, `shots=${g.shots} needs shots/${n}.webp`);
  } else if (g.preview || g.shots) err(w, 'preview and shots need assets=true');
  if (!Array.isArray(g.controls) || !g.controls.length) err(w, 'controls required');
  if (!g.description) err(w, 'description required');
  if (!['published', 'draft', 'removed'].includes(g.status)) err(w, 'status must be published, draft or removed');
  if (!g.compat || !COMPAT.includes(g.compat.status)) err(w, 'compat.status invalid');
  else if (g.compat.status !== 'untested' && (!/^\d{4}-\d{2}-\d{2}$/.test(g.compat.testedAt || '') || !(g.compat.browsers || []).length)) err(w, 'tested games need compat.testedAt and compat.browsers');
}
if (errors.length) { console.error(`Originals validation failed:\n - ` + errors.join('\n - ')); process.exit(1); }
console.log(`Originals OK: ${data.games.length} games.`);
