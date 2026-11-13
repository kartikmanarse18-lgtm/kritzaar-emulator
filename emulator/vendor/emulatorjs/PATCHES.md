# KritZaar changes to EmulatorJS 4.2.3 (GPL-3.0)

EmulatorJS is used unmodified except for these changes, made so that playing a game never contacts a third-party server:

1. `data/src/emulator.js`: `checkForUpdates()` returns immediately (it pinged a CDN for the latest version).
2. `data/src/emulator.js`: the three `https://cdn.emulatorjs.org/` fallback URLs now point to `/__no-third-party-cdn__/`, so a missing core can never be fetched from a third party.
3. `data/emulator.min.js` / `emulator.min.css` are plain concatenations of the files in `data/src/` and `emulator.css` (no minification), so the loader does not request files that do not exist.
4. Only the non-threaded `fceumm` (NES) and `mgba` (Game Boy family) cores are included. Threaded builds need cross-origin isolation headers this site does not set.

Cores shipped: FCEUmm (GPL-2.0), mGBA (MPL-2.0). Cores deliberately NOT shipped: Snes9x and Genesis Plus GX, whose licenses restrict commercial use.
Upstream: https://github.com/EmulatorJS/EmulatorJS (npm `@emulatorjs/emulatorjs@4.2.3`, `@emulatorjs/core-fceumm@4.2.3`, `@emulatorjs/core-mgba@4.2.3`).
