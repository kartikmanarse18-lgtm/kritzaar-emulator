// KritZaar bundler: inspects dropped archives and builds a js-dos bundle.
// Runs entirely in the browser. File contents never leave the device.
import { unzipSync, zipSync } from './vendor/fflate/fflate.js';

const MAX_UNPACKED_BYTES = 1.5 * 1024 * 1024 * 1024; // guard against zip bombs
const EXE_RE = /\.(exe|com|bat)$/i;
const IMG_RE = /\.(iso|img|ima)$/i;   // CD / floppy images: mounted, then you reach the DOS prompt
const FLOPPY_MAX = 2949120;           // 2.88 MB; larger .img files are treated as CD images
// Names that are usually installers or tools, not the game itself.
const NOISE_RE = /(^|[\\/_.-])(setup|install|instal|uninst|unins|config|setsound|sound|readme|dos4gw|pkunzip|uninstall|catalog|order|mscdex)/i;

function fail(code, message) {
  const err = new Error(message);
  err.code = code;
  return err;
}

// DOSBox runs DOS programs only. Windows programs (PE, or 16-bit NE) cannot run in it.
// Returns 'windows' for those, otherwise null. DOS extenders (LE/LX) are fine.
export function windowsKind(bytes) {
  if (!bytes || bytes.length < 0x40 || bytes[0] !== 0x4d || bytes[1] !== 0x5a) return null;
  const off = bytes[0x3c] | (bytes[0x3d] << 8) | (bytes[0x3e] << 16) | (bytes[0x3f] << 24 >>> 0);
  if (off <= 0 || off + 4 > bytes.length) return null;
  const a = bytes[off], b = bytes[off + 1];
  if (a === 0x50 && b === 0x45 && bytes[off + 2] === 0 && bytes[off + 3] === 0) return 'windows'; // PE
  if (a === 0x4e && b === 0x45) return 'windows';                                                  // NE (Win16)
  return null;
}
export const WINDOWS_MESSAGE = 'This is a Windows program. This player runs DOS games only (DOSBox). Look for the DOS version of the game. GOG and Steam installers are Windows programs; install on a computer and check whether the game folder has a DOS version.';

async function readBytes(file) {
  return new Uint8Array(await file.arrayBuffer());
}

// Returns [{ name, size }] for real files; nothing is decompressed.
function listEntries(bytes) {
  const entries = [];
  let total = 0;
  try {
    unzipSync(bytes, {
      filter(info) {
        total += info.originalSize;
        if (total > MAX_UNPACKED_BYTES) throw fail('BAD_ARCHIVE', 'This archive unpacks to more than the browser can handle.');
        if (!info.name.endsWith('/')) entries.push({ name: info.name, size: info.originalSize });
        return false;
      },
    });
  } catch (e) {
    if (typeof e.code === 'string') throw e; // our own error; fflate's errors carry a numeric code
    throw fail('BAD_ARCHIVE', 'This file is not a valid zip archive. Download it again from the official page.');
  }
  return entries;
}

// Drops junk entries and a single wrapping top-level folder.
function normalise(entries) {
  let list = entries
    .map((e) => ({ ...e, name: e.name.replace(/\\/g, '/').replace(/^\/+/, '') }))
    .filter((e) => e.name && !e.name.startsWith('__MACOSX/') && !/(^|\/)\.DS_Store$/.test(e.name) && !e.name.split('/').includes('..'));
  const tops = new Set(list.map((e) => (e.name.includes('/') ? e.name.split('/')[0] : null)));
  const prefix = tops.size === 1 && !tops.has(null) ? [...tops][0] + '/' : '';
  if (prefix) list = list.map((e) => ({ ...e, original: e.name, name: e.name.slice(prefix.length) }));
  else list = list.map((e) => ({ ...e, original: e.name }));
  return { list, prefix };
}

export async function inspectArchive(file, { exeHint } = {}) {
  const bytes = await readBytes(file);
  const raw = listEntries(bytes);
  if (raw.some((e) => e.name.replace(/\\/g, '/').toLowerCase() === '.jsdos/dosbox.conf')) {
    return { kind: 'jsdos', entries: raw.map((e) => e.name), executables: [], suggestedExe: null };
  }
  const { list } = normalise(raw);
  if (!list.length) throw fail('BAD_ARCHIVE', 'The archive is empty.');
  const executables = list.filter((e) => EXE_RE.test(e.name) || IMG_RE.test(e.name)).map((e) => e.name)
    .sort((a, b) => noise(a) - noise(b) || a.split('/').length - b.split('/').length || a.localeCompare(b));
  if (!executables.length) throw fail('NO_EXECUTABLE', 'No DOS program (.exe, .com or .bat) or disk image (.iso, .img) was found in this archive.');

  let suggestedExe = null;
  if (exeHint) {
    const h = exeHint.replace(/\\/g, '/').toLowerCase();
    suggestedExe = executables.find((x) => x.toLowerCase() === h)
      || executables.find((x) => x.toLowerCase().endsWith('/' + h) || x.toLowerCase().split('/').pop() === h) || null;
  }
  if (!suggestedExe) {
    const clean = executables.filter((x) => !noise(x));
    if (executables.length === 1) suggestedExe = executables[0];
    else if (clean.length === 1) suggestedExe = clean[0];
  }
  return { kind: 'zip', entries: list.map((e) => e.name), executables, suggestedExe };
}

// Checks (without storing anything) that the chosen program is a DOS program, not a Windows one.
export async function verifyRunnable(file, exe) {
  if (!exe || !EXE_RE.test(exe)) return;
  const bytes = await readBytes(file);
  if (bytes.length >= 2 && bytes[0] === 0x50 && bytes[1] === 0x4b) {
    const raw = listEntries(bytes);
    const { list } = normalise(raw);
    const hit = list.find((e) => e.name === exe);
    if (!hit) return;
    const wanted = hit.original;
    let files;
    try { files = unzipSync(bytes, { filter: (info) => info.name === wanted }); } catch { return; }
    const data = files[wanted];
    if (data && windowsKind(data.subarray(0, Math.min(data.length, 1 << 16)))) throw fail('WINDOWS_EXE', WINDOWS_MESSAGE);
  }
}

function noise(name) {
  return NOISE_RE.test(name.split('/').pop()) ? 1 : 0;
}

// Only simple, whitelisted values reach the generated dosbox.conf.
function buildConf(exe, config = {}, size = 0) {
  if (/[\r\n\0"]/.test(exe)) throw fail('BAD_ARCHIVE', 'The program name contains characters that cannot be used.');
  const parts = exe.split('/');
  const prog = parts.pop();
  const dir = parts.join('\\');
  const cycles = /^(auto|max|\d{3,6})$/.test(String(config.cycles || '')) ? String(config.cycles) : 'auto';
  const memsize = [16, 32, 64].includes(Number(config.memsize)) ? Number(config.memsize) : 16;
  const lines = [
    '[sdl]', 'autolock=false',
    '[cpu]', 'core=auto', `cycles=${cycles}`,
    '[dosbox]', `memsize=${memsize}`,
    '[mixer]', 'rate=44100',
    '[sblaster]', 'sbtype=sb16', 'sbbase=220', 'irq=7', 'dma=1', 'hdma=5',
    '[autoexec]', '@echo off', 'mount c .', 'c:',
  ];
  if (dir) lines.push(`cd ${dir}`);
  if (IMG_RE.test(prog)) {
    const floppy = /\.(img|ima)$/i.test(prog) && size > 0 && size <= FLOPPY_MAX;
    if (floppy) lines.push(`imgmount a ${prog} -t floppy`, 'a:');
    else lines.push(`imgmount d ${prog} -t iso`, 'd:');
    lines.push('@echo Disk mounted. Type DIR to see the files, then type the program name.');
    return lines.join('\n') + '\n';   // no exit: stay at the DOS prompt
  }
  lines.push(prog);
  lines.push('exit');
  return lines.join('\n') + '\n';
}

// Returns a Blob in .jsdos format (a zip with .jsdos/dosbox.conf).
export async function buildBundle(file, { exe, config } = {}) {
  const bytes = await readBytes(file);
  const raw = listEntries(bytes);
  if (raw.some((e) => e.name.replace(/\\/g, '/').toLowerCase() === '.jsdos/dosbox.conf')) {
    return new Blob([bytes], { type: 'application/zip' });
  }
  if (!exe) throw fail('NO_EXECUTABLE', 'No program was chosen to start.');
  const { list } = normalise(raw);
  if (!list.some((e) => e.name === exe)) throw fail('NO_EXECUTABLE', 'The chosen program is not in this archive.');
  const keep = new Map(list.map((e) => [e.original, e.name]));
  let files;
  try {
    files = unzipSync(bytes, { filter: (info) => keep.has(info.name) && !info.name.endsWith('/') });
  } catch {
    throw fail('BAD_ARCHIVE', 'This archive could not be unpacked. Download it again from the official page.');
  }
  const chosen = list.find((e) => e.name === exe);
  if (chosen && EXE_RE.test(exe) && files[chosen.original] && windowsKind(files[chosen.original].subarray(0, 1 << 16))) throw fail('WINDOWS_EXE', WINDOWS_MESSAGE);
  const out = {};
  for (const [orig, data] of Object.entries(files)) out[keep.get(orig)] = [data, { level: 0 }];
  out['.jsdos/dosbox.conf'] = [new TextEncoder().encode(buildConf(exe, config, (list.find((e) => e.name === exe) || {}).size)), { level: 0 }];
  return new Blob([zipSync(out)], { type: 'application/zip' });
}

// Overlays a saved state (the changed-files archive from the emulator) onto a bundle.
// Returns a new Blob; the original bundle is not modified.
export async function applyState(bundleBlob, stateBytes) {
  try {
    const base = unzipSync(new Uint8Array(await bundleBlob.arrayBuffer()));
    const changes = unzipSync(stateBytes);
    for (const [name, data] of Object.entries(changes)) {
      if (!name.startsWith('.jsdos/') && !name.endsWith('/')) base[name] = [data, { level: 0 }];
    }
    return new Blob([zipSync(base)], { type: 'application/zip' });
  } catch {
    throw fail('BAD_ARCHIVE', 'This saved state could not be read.');
  }
}
