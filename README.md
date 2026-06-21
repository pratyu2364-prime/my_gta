# Gully Run — an open-world driving sandbox

An original free-roam driving sandbox set in a procedurally generated city, built with
**three.js r128** as a static ES-module project (no build step). `index.html` is a thin shell
(HUD, menus, import map) that loads `src/main.js`. three.js and the font are vendored locally
under `vendor/`, so the game runs **fully offline**.

## Run it (web / dev)

ES modules need to be served over HTTP (not `file://`). From the repo root:

```bash
python3 -m http.server 8099
# then open http://localhost:8099/index.html
```

The hosted build is the same files served statically (e.g. GitHub Pages).

## Controls

| Key | Action |
|---|---|
| W A S D / arrows | drive / walk |
| MOUSE | look around & aim (click to lock the pointer) |
| E | enter / exit vehicles, carjack (walk to door, pull the driver out) |
| SPACE | handbrake — drift |
| SHIFT | nitro boost / sprint |
| CLICK / F | shoot |
| Q | switch weapon |
| H | horn |
| M | full city map |
| ESC | pause |

From the main menu: **New Game**, **Continue** (restores saved money/weapons), **Settings**
(volume, mouse sensitivity, invert-Y, graphics quality).

## Features

- Asymmetric procedural city — irregular road grid, districts, parks; a different layout each load
- Mouse-look third-person camera that also steers you on foot
- Cars, motorcycles and auto-rickshaws, all stealable with a full carjack sequence
- GPU-instanced crowds, talkable NPCs, roaming cows, market stalls and street furniture
- Enterable landmarks with interiors (hospital, food court, police station)
- Wanted system (up to 5 stars), pursuing cruisers and foot officers, drive-bys
- Living traffic — lane keeping, traffic lights, braking for pedestrians
- Day/night cycle with headlights, lit windows and street lamps
- Missions — taxi, vigilante, race circuit, courier deliveries
- Progression auto-save, pause, settings, synthesized Web Audio (no audio files)

## Desktop build (Electron) → Steam

The game ships as a desktop app via Electron. The Electron main process serves the static
files over an in-process `localhost` origin (not `file://`) so ES modules, the import map and
`fetch()` for models/HDRI all work exactly as on the web.

```bash
npm install            # installs electron + electron-builder (dev deps)
npm start              # run the desktop app locally
npm run dist           # build installers for the current OS into dist-electron/
npm run dist:dir       # build the unpacked app dir (what you upload to Steam via SteamPipe)
```

**Steam checklist (done outside this repo):** Steamworks partner account + $100 Steam Direct
fee per app, identity/tax/bank verification, age-rating questionnaire, store-page assets, then
upload the `dist:dir` build with SteamPipe. The app is original-IP and contains no third-party
trademarks.

## Dev / testing

See [CLAUDE.md](CLAUDE.md) for architecture notes and the headless test harness.
`scripts/vendor-three.mjs` re-vendors three.js + addons locally if needed.
