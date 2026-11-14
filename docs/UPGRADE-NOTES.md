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

## Start screen, ads and web games (round 2)
- Start screen (`emulator/index.html`, `emulator/player.js`): previews of other games on both sides (2 Originals + Playgama picks), sponsor slots and an "Advertise on KritZaar" contact card below. Rails and ads exist only on this screen and are removed when the game starts.
- Ads (`js/ads.js`, `data/ads.json`): direct-sponsor banners only (images from your own domain, labelled Sponsored, weighted, date-limited). Slots: `under` 728x90, `side` and `side2` 300x250, `strip` 970x90. **Set `contact` in `data/ads.json`** (currently `mailto:CONTACT_EMAIL_HERE`); until then the card says contact details are not set up.
- Web games (`play/`, `data/web-games.json`): 67 Playgama games from your feed, embedded in a sandboxed iframe from `playgama.com` (allow-list in `data/site-config.json` `embedHosts`). Three feed games on other hosts were left out. No ads are placed on the web-game page: check Playgama's partner terms before adding any.
- Controls: on-screen controls are closed by default. A **Controls** button (top-left of the game) opens and closes them and remembers the choice. Controller dialog: closed-until-tapped / always open / never.
- `legal/privacy.html` and `legal/how-it-works.html` updated (they said "no ads on the player page" and had no mention of embedded web games). Please review the wording.
- `sw.js` bumped to v5.

## Design pass (round 3)
- Buttons: one system. Tonal by default, one solid orange primary (Play) with a crisp press edge. No glow. Orange label contrast is about 8:1.
- Start screen: hero with title and genre tags over the game art (phones: art on top at true 16:9, title below), fixed Play bar in the thumb zone on phones, Auto-save as a switch, More games as a swipeable row, one compact sponsor slot on phones (300x250 slots return on tablet and desktop).
- Frames: crisp purple-to-orange edge on the hero, the game window and the web-game window (desktop and tablet). Phones go edge to edge.
- Enter or Space starts the game from the start screen. Play shows "Starting..." while loading.
- Applied: Shneiderman's eight golden rules (consistency, shortcuts, feedback, closure, easy reversal, user control, low memory load), an 8 px spacing grid, 44 px minimum touch targets, and one primary action per screen.

## Round 4 (arcade, ads, controller)
- **Whole arcade on the home page and /games/** (`js/arcade.js`, `css/arcade.css`): Originals, all web games, the classic PC catalog and the Arcade bridge in one grid with search (press `/`), type chips (Originals / Web games / Classic PC), genre chips and "Show more" plus automatic loading as you scroll. `?q=word` on the home page pre-fills the search. New games added to `data/originals.json`, `data/web-games.json`, `data/games.json` or `data/arcade.json` appear automatically.
- **Ads**: the 728x90 sponsor strip now sits inside the game preview card. 300x250 slots keep one size and sit side by side (or under the side rails on wide screens, hidden on phones). The advertise card is a slim one-line link. Empty-slot boxes can be hidden: set `"showPlaceholders": false` in `data/ads.json` (currently `true` so you can see the layout). With no contact set and placeholders off, slots collapse completely.
- **Controller** (`emulator/index.html`, `emulator/player.js`, `emulator/player.css`): the old dialog was wider than a phone screen, so its Close button could not be reached. It is now a bottom sheet (centred panel on larger screens) with Touch, Gamepad and Keyboard tabs. Gamepad tab: live view of every button and both sticks, presets (Classic, Platformer, Shooter), remap list, rumble test. Touch tab: tap-to-open / always / off, layout cards, size, opacity, vibration, left-handed, customize. It opens from the header, from a floating gamepad button on the game (works in fullscreen) and from "Controller settings" on the start screen. The game pauses while the sheet is open and resumes when it closes.
- Cards without artwork show a game icon instead of repeating the title.
- `sw.js` bumped to v6.
