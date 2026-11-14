# Upgrade: controllers + game previews

## Controllers
- `js/touch-controls.js`: new **fps** layout (stick, Fire/Use/Run/Strafe, weapons 1-4), a "Keys" drawer (Esc, Enter, Y, N, 1-6, F1-F10...), size, opacity, vibration and left-handed options.
- `js/gamepad.js`: physical gamepad support for DOS and Original games. Classic or dual-stick shooter mode, every button remappable, saved per game. The game pauses if the pad disconnects.
- **Customize buttons** (Controller dialog): drag any on-screen control, resize it, change the key it sends, hide it, or add extra buttons. Saved per game and per layout on this device; Reset restores the preset.
- Player: new **Controller** button opens the settings dialog. Fullscreen on phones tries landscape.
- Bug fix: touch buttons previously sent DOM key numbers that js-dos did not understand. They now send key names.
- Use the shooter layout for a catalog game with `"touchLayout": "fps"` in `data/games.json`.
  Custom DOS games with no catalog entry now get `dpad-4btn` by default.

## Previews (asset standard: `assets/games/<id>/`)
- `js/cards.js` + `css/cards.css`: hover-preview cards, hero slider, category chips. Previews respect reduced motion and Save-Data, and play one at a time on touch screens.
- `data/originals.json`: new fields `assets`, `preview`, `shots`, `featured`.
- The 3 Originals ship with real gameplay clips (webm + mp4), cover, banner, icon and 3 screenshots.
- To add assets for another game: put files in `assets/games/<id>/`, set `"assets": true` (plus `"preview": true`, `"shots": N`) and run `node scripts/validate-originals.mjs`.
- `sw.js` bumped to v4.
