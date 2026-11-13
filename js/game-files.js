// KritZaar: turns whatever the person picks into one archive the player understands.
//   .zip / .jsdos          -> used as they are
//   .exe .com .bat         -> wrapped into a zip (a lone DOS program)
//   .iso .img .ima         -> wrapped into a zip (mounted as a CD / floppy)
//   several files at once  -> bundled into one zip (e.g. GAME.EXE + its data files)
// Windows programs are rejected with a clear message: DOSBox cannot run them.
// Runs entirely in the browser; nothing is uploaded.
import { zipSync } from '../emulator/vendor/fflate/fflate.js';
import { windowsKind, WINDOWS_MESSAGE } from '../emulator/bundler.js';

export const RUN_EXT = ['.exe', '.com', '.bat'];
export const IMAGE_EXT = ['.iso', '.img', '.ima'];
export const ARCHIVE_EXT = ['.zip', '.jsdos'];
export const SUPPORTED_EXT = [...ARCHIVE_EXT, ...RUN_EXT, ...IMAGE_EXT];
const UNSUPPORTED_ARCHIVES = ['.7z', '.rar', '.tar', '.gz', '.tgz', '.bz2', '.xz', '.cab'];
const MAX_WRAP_BYTES = 800 * 1024 * 1024;

const ext = (name) => { const m = /\.[^.\\/]+$/.exec(String(name || '').toLowerCase()); return m ? m[0] : ''; };
const base = (name) => String(name || '').replace(/^.*[\\/]/, '');
const err = (message, code) => Object.assign(new Error(message), code ? { code } : {});

async function headerCheck(file) {
  // Read just enough of the file to see whether it is a Windows program.
  const head = new Uint8Array(await file.slice(0, 64).arrayBuffer());
  if (head.length < 0x40 || head[0] !== 0x4d || head[1] !== 0x5a) return;
  const off = head[0x3c] | (head[0x3d] << 8) | (head[0x3e] << 16) | (head[0x3f] << 24 >>> 0);
  if (off <= 0 || off + 4 > file.size) return;
  const probe = new Uint8Array(await file.slice(0, off + 4).arrayBuffer());
  if (windowsKind(probe)) throw err(WINDOWS_MESSAGE, 'WINDOWS_EXE');
}

/** Returns one File the player can store and run. Throws an Error with a readable message. */
export async function prepareDroppedFiles(files) {
  const list = Array.from(files || []);
  if (!list.length) throw err('No file was chosen.');
  if (list.some((f) => f.size === 0)) throw err('One of the files is empty. Download it again from the official page.');

  if (list.length === 1) {
    const f = list[0], e = ext(f.name);
    if (ARCHIVE_EXT.includes(e)) return f;
    if (UNSUPPORTED_ARCHIVES.includes(e)) throw err('This player cannot open ' + e + ' files. Extract it on your device and choose the files inside, or make a .zip of the game folder.');
    if (!RUN_EXT.includes(e) && !IMAGE_EXT.includes(e)) throw err('KritZaar could not recognise that file. It runs DOS games, NES, Game Boy / Color / Advance and Flash (.swf) files.');
  }

  const total = list.reduce((a, f) => a + f.size, 0);
  if (total > MAX_WRAP_BYTES) throw err('These files are too big to prepare in the browser. Put them in a .zip and choose that instead.');
  if (list.some((f) => UNSUPPORTED_ARCHIVES.includes(ext(f.name)))) throw err('One of the files is an archive this player cannot open. Choose a .zip, or the extracted files.');

  const runnable = list.filter((f) => RUN_EXT.includes(ext(f.name)));
  const images = list.filter((f) => IMAGE_EXT.includes(ext(f.name)));
  if (!runnable.length && !images.length) throw err('No DOS program (.exe, .com, .bat) or disk image (.iso, .img) is in your selection.');

  // Check each program; refuse only if every program is a Windows one.
  let windows = 0;
  for (const f of runnable) { try { await headerCheck(f); } catch (e) { if (e.code === 'WINDOWS_EXE') windows++; else throw e; } }
  if (runnable.length && windows === runnable.length && !images.length) throw err(WINDOWS_MESSAGE, 'WINDOWS_EXE');

  const out = {}; const used = new Set();
  for (const f of list) {
    let n = base(f.name) || 'file', k = 1;
    while (used.has(n.toLowerCase())) n = k++ + '_' + base(f.name);
    used.add(n.toLowerCase());
    out[n] = [new Uint8Array(await f.arrayBuffer()), { level: 0 }];
  }
  const first = (runnable[0] || images[0] || list[0]).name;
  const zipName = base(first).replace(/\.[^.]+$/, '') + '.zip';
  return new File([zipSync(out)], zipName, { type: 'application/zip' });
}
