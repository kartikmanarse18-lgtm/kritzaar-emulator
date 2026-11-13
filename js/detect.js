// KritZaar automatic format detection. Looks at the bytes first, the file name second.
// Runs in the browser; nothing is uploaded. Returns a plain result object, never throws for "unknown".
//   const d = await detectFormat(files);
//   d.ok ? d.platform / d.engine / d.core / d.file : d.problem {code, message}
import { unzipSync } from '../emulator/vendor/fflate/fflate.js';
import { prepareDroppedFiles } from './game-files.js';
import { PLATFORMS, KNOWN_UNSUPPORTED, platformLabel, engineOf } from './engines.js';

const ext = (n) => { const m = /\.[^.\\/]+$/.exec(String(n || '').toLowerCase()); return m ? m[0] : ''; };
const base = (n) => String(n || '').replace(/^.*[\\/]/, '');
const ROM_EXT = { '.nes': 'nes', '.gb': 'gb', '.gbc': 'gbc', '.gba': 'gba', '.swf': 'flash' };
const UNSUP_EXT = { '.sfc': 'snes', '.smc': 'snes', '.md': 'genesis', '.gen': 'genesis', '.smd': 'genesis', '.z64': 'n64', '.n64': 'n64', '.v64': 'n64', '.nds': 'nds', '.cue': 'psx', '.pbp': 'psx', '.chd': 'psx' };
const MAX_ROM_BYTES = 64 * 1024 * 1024; // none of the supported systems comes close

const problem = (code, message, extra = {}) => ({ ok: false, platform: extra.recognized || null, engine: null, core: null, confidence: 'high', reasons: extra.reasons || [], problem: { code, message }, file: null, ...extra });

function unsupported(kind, why) {
  const k = KNOWN_UNSUPPORTED[kind];
  return problem('UNSUPPORTED_PLATFORM', `This looks like a ${k.label} game. KritZaar cannot run it: ${why || k.why}.`, { recognized: kind, reasons: ['recognised as ' + k.label] });
}

/** Identify a ROM-like file from its first bytes. Returns { platform, confidence, reasons } or null. */
export function sniffBytes(head, size, name = '') {
  const e = ext(name), reasons = [];
  const b = head;
  const at = (i) => (i < b.length ? b[i] : -1);
  const ascii = (i, s) => [...s].every((c, k) => at(i + k) === c.charCodeAt(0));

  if (ascii(0, 'NES') && at(3) === 0x1a) return { platform: 'nes', confidence: 'high', reasons: ['iNES header'] };
  if ((ascii(0, 'FWS') || ascii(0, 'CWS') || ascii(0, 'ZWS')) && at(3) > 0 && at(3) < 60) return { platform: 'flash', confidence: 'high', reasons: ['SWF header'] };
  if (at(0) === 0x4d && at(1) === 0x5a) return { platform: 'dosexe', confidence: 'high', reasons: ['MZ executable header'] };

  // Game Boy Advance: fixed byte 0x96 at 0xB2 and a complement checksum at 0xBD.
  if (b.length > 0xbe && at(0xb2) === 0x96) {
    let s = 0; for (let i = 0xa0; i <= 0xbc; i++) s += b[i];
    const ok = ((-(s + 0x19)) & 0xff) === b[0xbd];
    if (ok || e === '.gba') return { platform: 'gba', confidence: ok ? 'high' : 'medium', reasons: [ok ? 'GBA header checksum valid' : 'GBA header found, checksum does not match'] };
  }
  // Game Boy / Color: header checksum over 0x134..0x14C stored at 0x14D.
  if (b.length > 0x150) {
    let x = 0; for (let i = 0x134; i <= 0x14c; i++) x = (x - b[i] - 1) & 0xff;
    const ok = x === b[0x14d];
    const cgb = at(0x143) === 0x80 || at(0x143) === 0xc0;
    if (ok && (e === '.gb' || e === '.gbc' || size % 0x4000 === 0)) return { platform: cgb || e === '.gbc' ? 'gbc' : 'gb', confidence: 'high', reasons: ['Game Boy header checksum valid'] };
    if (e === '.gb' || e === '.gbc') return { platform: e === '.gbc' ? 'gbc' : 'gb', confidence: 'medium', reasons: ['file extension ' + e + ', header checksum does not match'] };
  }
  if (b.length > 0x104 && ascii(0x100, 'SEGA')) return { platform: 'genesis', confidence: 'high', reasons: ['SEGA header'] };
  if (at(0) === 0x80 && at(1) === 0x37 && at(2) === 0x12 && at(3) === 0x40) return { platform: 'n64', confidence: 'high', reasons: ['N64 header'] };
  if (at(0) === 0x37 && at(1) === 0x80 && at(2) === 0x40 && at(3) === 0x12) return { platform: 'n64', confidence: 'high', reasons: ['N64 header (byte-swapped)'] };

  if (ROM_EXT[e]) return { platform: ROM_EXT[e], confidence: 'low', reasons: ['file extension ' + e + ' only'] };
  if (UNSUP_EXT[e]) return { platform: UNSUP_EXT[e], confidence: 'medium', reasons: ['file extension ' + e] };
  return null;
}

async function sniffFile(file) {
  const head = new Uint8Array(await file.slice(0, 0x200).arrayBuffer());
  return sniffBytes(head, file.size, file.name);
}

function fromRom(sniffed, file, extra = {}) {
  const platform = sniffed.platform;
  if (platform === 'dosexe') return null;
  if (!PLATFORMS[platform]) return unsupported(platform);
  if (file.size > MAX_ROM_BYTES) return problem('UNSUPPORTED_FORMAT', 'This file is much bigger than any game this player can run. Check that it is the right file.');
  return { ok: true, platform, engine: engineOf(platform), core: PLATFORMS[platform].core || null, confidence: sniffed.confidence, reasons: sniffed.reasons, problem: null, file, label: platformLabel(platform), ...extra };
}

// Look inside a zip without unpacking it all; decide DOS vs ROM vs Flash vs web game.
async function detectZip(file) {
  let bytes, names = [];
  try {
    bytes = new Uint8Array(await file.arrayBuffer());
    unzipSync(bytes, { filter: (i) => { if (!i.name.endsWith('/')) names.push(i.name); return false; } });
  } catch { return problem('BAD_ARCHIVE', 'This zip file could not be opened. Download it again from the official page and do not unzip it.'); }
  names = names.filter((n) => !n.startsWith('__MACOSX/') && !/(^|\/)\.DS_Store$/.test(n));
  const lower = names.map((n) => n.toLowerCase());
  if (lower.includes('.jsdos/dosbox.conf')) return { ok: true, platform: 'dos', engine: 'jsdos', core: null, confidence: 'high', reasons: ['.jsdos bundle'], problem: null, file, label: 'DOS' };
  const dosHits = lower.filter((n) => /\.(exe|com|bat)$/.test(n) || /\.(iso|img|ima)$/.test(n));
  const roms = names.filter((n) => ROM_EXT[ext(n)] && !n.includes('/__'));
  if (roms.length && !dosHits.length) {
    const name = roms.sort((a, b) => a.length - b.length)[0];
    let data;
    try { data = unzipSync(bytes, { filter: (i) => i.name === name })[name]; } catch { return problem('BAD_ARCHIVE', 'The game inside this zip could not be read.'); }
    const rom = new File([data], base(name), { type: 'application/octet-stream' });
    const s = await sniffFile(rom);
    const r = s && fromRom(s, rom, {});
    if (r) { r.reasons = [...r.reasons, `found ${base(name)} inside the zip` + (roms.length > 1 ? ` (using the first of ${roms.length} games)` : '')]; return r; }
  }
  if (dosHits.length) return { ok: true, platform: 'dos', engine: 'jsdos', core: null, confidence: 'medium', reasons: ['zip contains a DOS program or disk image'], problem: null, file, label: 'DOS' };
  const unsup = names.map((n) => UNSUP_EXT[ext(n)]).find(Boolean);
  if (unsup) return unsupported(unsup);
  if (lower.some((n) => /(^|\/)index\.html?$/.test(n))) return unsupported('web');
  return problem('UNKNOWN_FORMAT', 'KritZaar could not tell what kind of game is in this zip. It looks for DOS programs, Game Boy, NES or Flash files.');
}

/** Main entry. files: File | File[] */
export async function detectFormat(files) {
  const list = Array.from(files && files.length !== undefined && !(files instanceof File) ? files : [files]).filter(Boolean);
  if (!list.length) return problem('UNKNOWN_FORMAT', 'No file was chosen.');
  if (list.some((f) => f.size === 0)) return problem('BAD_ARCHIVE', 'One of the files is empty. Download it again from the official page.');

  if (list.length === 1) {
    const f = list[0], e = ext(f.name);
    const head = new Uint8Array(await f.slice(0, 4).arrayBuffer());
    const isZip = head[0] === 0x50 && head[1] === 0x4b && (e === '.zip' || e === '.jsdos' || head[2] === 3);
    if (isZip) return detectZip(f);
    const s = await sniffFile(f);
    if (s && s.platform !== 'dosexe') return fromRom(s, f) || problem('UNKNOWN_FORMAT', 'Unrecognised file.');
    if (['.7z', '.rar', '.tar', '.gz', '.tgz', '.bz2', '.xz', '.cab'].includes(e)) return problem('UNSUPPORTED_FORMAT', 'This player cannot open ' + e + ' files. Extract it on your device and choose the files inside, or make a .zip.');
  }
  // Everything else (single .exe/.iso/.img, or several files) is the DOS path, which also rejects Windows programs.
  try {
    const file = await prepareDroppedFiles(list);
    return { ok: true, platform: 'dos', engine: 'jsdos', core: null, confidence: file === list[0] ? 'medium' : 'high', reasons: ['DOS program or disk image'], problem: null, file, label: 'DOS' };
  } catch (e) {
    if (e.code === 'WINDOWS_EXE') return unsupported('windows', 'this is a Windows program and the player runs DOS games only. Look for the DOS version');
    return problem('UNKNOWN_FORMAT', e.message || 'KritZaar could not tell what kind of game this is.', { reasons: ['no known game format found'] });
  }
}
