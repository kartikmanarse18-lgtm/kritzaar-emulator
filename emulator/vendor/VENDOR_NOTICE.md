# Vendored libraries (self-hosted, pinned)

Third-party ENGINES only. No game files are stored anywhere in this site's code or data (the separation check enforces it).

| Library | Version | License | Used for | Source |
|---|---|---|---|---|
| js-dos (+ DOSBox WASM build) | 8.5.4 | GPL-2.0 (DOSBox GPL-2.0+) | DOS | https://github.com/caiiiycuk/js-dos |
| EmulatorJS | 4.2.3 | GPL-3.0 | NES, Game Boy family front end | https://github.com/EmulatorJS/EmulatorJS (patched, see `emulatorjs/PATCHES.md`) |
| FCEUmm core (EmulatorJS build) | 4.2.3 | GPL-2.0 | NES | https://github.com/libretro/libretro-fceumm |
| mGBA core (EmulatorJS build) | 4.2.3 | MPL-2.0 | Game Boy / Color / Advance | https://github.com/mgba-emu/mgba |
| Ruffle | 0.7.1 (npm `@ruffle-rs/ruffle`) | MIT OR Apache-2.0 | Flash (.swf) | https://github.com/ruffle-rs/ruffle |
| fflate | 0.8.3 | MIT | zip reading/writing | https://github.com/101arrowz/fflate |

Core license texts are not bundled inside the EmulatorJS core npm packages. The licenses above are from each core's upstream project; confirm them against the upstream repositories before launch.
GPL/MPL notice: the site's /legal/how-it-works.html links to the corresponding source for each engine.
Deliberately not shipped: Snes9x and Genesis Plus GX (non-commercial licenses; this site may show ads).
Folders: `emulatorjs/` (loader, cores for fceumm + mgba), `ruffle/` (ruffle.js + 2 wasm builds, about 28 MB, downloaded only when a Flash game is played).
