// Guards the line between KritZaar's own games and third-party games.
//  1. The deployable site must not contain any third-party game file (ROMs, disk images, SWF, installers, zips).
//  2. /originals/ must be self-contained: no external URLs, no imports from outside /originals/ (except same-site engine-free kit).
//  3. data/games.json (third-party) must never point at a file hosted on this site; data/originals.json must be first-party only.
// Usage: node scripts/check-separation.mjs      (exit code 1 on any violation)
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, extname } from 'node:path';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SKIP = new Set(['_not-for-deploy', 'docs', 'node_modules', '.git']);
const GAME_EXT = new Set(['.nes', '.sfc', '.smc', '.gb', '.gbc', '.gba', '.gen', '.smd', '.z64', '.n64', '.v64', '.nds', '.swf', '.iso', '.img', '.ima', '.exe', '.com', '.bat', '.jsdos', '.zip', '.7z', '.rar', '.cue', '.chd', '.pbp', '.rom']);
const problems = [];
const walk = (dir) => readdirSync(dir).flatMap((n) => {
  if (SKIP.has(n)) return [];
  const p = join(dir, n);
  return statSync(p).isDirectory() ? walk(p) : [p];
});
const files = walk(root);

for (const f of files) if (GAME_EXT.has(extname(f).toLowerCase())) problems.push(`game-like file in the deploy tree: ${relative(root, f)}`);

for (const f of files.filter((x) => relative(root, x).startsWith('originals/') && /\.(js|html|css)$/.test(x))) {
  const src = readFileSync(f, 'utf8').replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  const rel = relative(root, f);
  for (const m of src.matchAll(/https?:\/\/[^\s'"`)<>]+/g)) if (!/^https?:\/\/www\.w3\.org\//.test(m[0])) problems.push(`${rel}: external URL ${m[0]}`);
  if (!/^originals\/(kit\.js|games\/)/.test(rel)) continue; // pages may use site UI; game code may not
  for (const m of src.matchAll(/(?:import\s[^'"]*from\s*|import\()\s*['"]([^'"]+)['"]/g)) if (!m[1].startsWith('/originals/') && !m[1].startsWith('./') && !m[1].startsWith('../')) problems.push(`${rel}: imports outside /originals/: ${m[1]}`);
}

const third = JSON.parse(readFileSync(join(root, 'data/games.json'), 'utf8')).games || [];
const own = JSON.parse(readFileSync(join(root, 'data/originals.json'), 'utf8')).games || [];
const ownIds = new Set(own.map((g) => g.id));
for (const g of third) {
  const w = `games.json (${g.id})`;
  if (ownIds.has(g.id)) problems.push(`${w}: id also used by an original`);
  for (const k of ['module', 'downloadUrl', 'fileUrl', 'romUrl']) if (g[k]) problems.push(`${w}: has "${k}"; third-party games must never be served by this site`);
  if (String(g.cover || '').startsWith('/originals/')) problems.push(`${w}: cover lives in /originals/; use /games/covers/`);
  try { if (/kritzaar/i.test(new URL(g.officialUrl).hostname)) problems.push(`${w}: officialUrl points at this site`); } catch { /* validate-catalog reports bad URLs */ }
}
for (const g of own) {
  if (g.license !== 'original' || g.platform !== 'native') problems.push(`originals.json (${g.id}): must be license "original" and platform "native"`);
  if (!String(g.module || '').startsWith('/originals/') || !String(g.cover || '').startsWith('/originals/')) problems.push(`originals.json (${g.id}): files must live under /originals/`);
}
const notice = readFileSync(join(root, 'emulator/vendor/VENDOR_NOTICE.md'), 'utf8').toLowerCase();
for (const d of readdirSync(join(root, 'emulator/vendor'), { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name)) {
  const key = { emulators: 'js-dos', fflate: 'fflate', emulatorjs: 'emulatorjs', ruffle: 'ruffle' }[d] || d;
  if (!notice.includes(key)) problems.push(`emulator/vendor/${d}: not listed in VENDOR_NOTICE.md`);
}
if (problems.length) { console.error('Separation check FAILED:\n - ' + problems.join('\n - ')); process.exit(1); }
console.log(`Separation OK: ${files.length} deploy files checked, ${own.length} originals, ${third.length} third-party catalog entries.`);
