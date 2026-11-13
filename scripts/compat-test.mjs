// Compatibility test for ONE game file, run on your own computer. It never uploads anything.
// Setup once:  npm i -D playwright && npx playwright install chromium
// Usage:       node scripts/compat-test.mjs <catalog-id> <path-to-your-legal-copy-of-the-game>
// It serves this folder locally, drops the file into the player like a person would, waits for the game to
// start, checks the screen is not blank, and prints a "compat" block to paste into the game's catalog entry
// (admin/catalog.html -> Compatibility). Only record "verified" after you have also played it by hand.
import http from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const [id, file] = process.argv.slice(2);
if (!id || !file || !existsSync(file)) { console.error('Usage: node scripts/compat-test.mjs <catalog-id> <game-file>'); process.exit(2); }
const { chromium } = await import('playwright');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.wasm': 'application/wasm', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const server = http.createServer((req, res) => {
  let p = join(root, decodeURIComponent(req.url.split('?')[0])); if (existsSync(p) && statSync(p).isDirectory()) p = join(p, 'index.html');
  if (!existsSync(p)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': MIME[extname(p)] || 'application/octet-stream' }); res.end(readFileSync(p));
}).listen(0);
const port = server.address().port, base = `http://localhost:${port}`;
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const page = await (await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1000, height: 700 } })).newPage();
const problems = []; page.on('pageerror', (e) => problems.push(String(e).slice(0, 160)));
let status = 'broken', note = '';
try {
  await page.goto(`${base}/emulator/index.html?game=${id}`);
  await page.waitForSelector('.kz-drop-zone', { timeout: 15000 });
  await page.waitForFunction("typeof KZPlayer!=='undefined'");
  await page.evaluate(() => { window.__ev = []; ['started', 'error'].forEach((n) => KZPlayer.on(n, (d) => window.__ev.push(n + ':' + JSON.stringify(d || '')))); });
  await page.setInputFiles('.kz-drop-zone input[type=file]', file);
  await page.waitForTimeout(15000);
  const ev = await page.evaluate(() => window.__ev);
  const errText = await page.evaluate(() => (document.getElementById('kzp-error').hidden ? '' : document.getElementById('kzp-error-text').textContent));
  if (errText) note = 'Player said: ' + errText.slice(0, 160);
  else if (ev.some((e) => e.startsWith('started'))) {
    const shot = await page.screenshot();
    status = shot.length > 6000 ? 'playable' : 'issues';   // a blank frame compresses to a tiny PNG
    note = status === 'playable' ? 'Started and drew to the screen in an automated run. Confirm by playing before marking verified.' : 'Started but the screen looked blank.';
  } else note = 'The game did not report that it started within 15 seconds.';
} catch (e) { note = String(e).slice(0, 160); }
console.log(JSON.stringify({ compat: { status, testedAt: new Date().toISOString().slice(0, 10), browsers: ['Chromium (automated, desktop)'], notes: note } }, null, 2));
if (problems.length) console.log('Page errors:', problems.slice(0, 3));
await browser.close(); server.close();
