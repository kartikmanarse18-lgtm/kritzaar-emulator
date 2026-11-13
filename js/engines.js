// KritZaar engine registry: which platforms exist, which engine runs each, and the license of that engine.
// This file is data only. Game files are never listed here.
export const ENGINES = {
  native:     { name: 'KritZaar Native', license: 'Original KritZaar code', source: '/originals/', vendored: false },
  jsdos:      { name: 'js-dos (DOSBox)', license: 'GPL-2.0', source: 'https://github.com/caiiiycuk/js-dos', vendored: true },
  emulatorjs: { name: 'EmulatorJS', license: 'GPL-3.0', source: 'https://github.com/EmulatorJS/EmulatorJS', vendored: true },
  ruffle:     { name: 'Ruffle', license: 'MIT OR Apache-2.0', source: 'https://github.com/ruffle-rs/ruffle', vendored: true },
};

// core = EmulatorJS core name. Only cores whose licenses allow use on a site that may show ads are shipped.
export const PLATFORMS = {
  native: { label: 'KritZaar Original', engine: 'native', exts: [] },
  dos:    { label: 'DOS',               engine: 'jsdos',  exts: ['.zip', '.jsdos', '.exe', '.com', '.bat', '.iso', '.img', '.ima'] },
  nes:    { label: 'NES / Famicom',     engine: 'emulatorjs', core: 'fceumm', exts: ['.nes'] },
  gb:     { label: 'Game Boy',          engine: 'emulatorjs', core: 'mgba',   exts: ['.gb'] },
  gbc:    { label: 'Game Boy Color',    engine: 'emulatorjs', core: 'mgba',   exts: ['.gbc'] },
  gba:    { label: 'Game Boy Advance',  engine: 'emulatorjs', core: 'mgba',   exts: ['.gba'] },
  flash:  { label: 'Flash (SWF)',       engine: 'ruffle',     exts: ['.swf'] },
};

// Recognised but deliberately not supported. We say so clearly instead of failing mysteriously.
export const KNOWN_UNSUPPORTED = {
  snes:    { label: 'Super Nintendo', why: 'the SNES emulator core has a non-commercial license that does not fit a site with ads' },
  genesis: { label: 'Sega Genesis / Mega Drive', why: 'the available Genesis core has a non-commercial license that does not fit a site with ads' },
  n64:     { label: 'Nintendo 64', why: 'it needs more power and features than this player offers today' },
  nds:     { label: 'Nintendo DS', why: 'it is not supported yet' },
  psx:     { label: 'PlayStation', why: 'it is not supported yet' },
  windows: { label: 'Windows program', why: 'this player cannot run Windows programs' },
  web:     { label: 'Web game', why: 'web games run on their own site and do not need an emulator' },
};

export const platformLabel = (p) => (PLATFORMS[p] && PLATFORMS[p].label) || String(p || 'Unknown');
export const engineOf = (p) => (PLATFORMS[p] && PLATFORMS[p].engine) || null;
export const ALL_EXTS = [...new Set(Object.values(PLATFORMS).flatMap((p) => p.exts))];
