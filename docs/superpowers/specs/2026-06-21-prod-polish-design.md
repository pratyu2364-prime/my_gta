# Prod-Polish Design (Sub-project B)

**Date:** 2026-06-21
**Status:** Approved (pending spec review)
**Goal:** Turn the tech demo into something that feels like a finished game — main menu, progression save, pause, essential settings, and debug-hook hardening. Ships to the existing web prod (GitHub Pages) and forms the foundation a future Steam build needs.

## Context

`index.html` is a thin shell (HUD DOM, `#intro` overlay, import map) loading `src/main.js`
(the game, one large `main()` closure mid-incremental-split into `src/{core,world,...}/`).
Current start flow: `#intro` overlay (z50) shows title + controls → click/keypress calls
`start()` → hides intro, sets `started=true`, inits audio, requests pointer lock. The main
loop (`animate()`) gates on `started`/`bigOpen`. Cheats use a keydown letter buffer.
There is no pause, no settings, and no persistence today. `window.__probe`/`__tp` test hooks
are always exposed.

This is one of four independent sub-projects toward shippability; the others
(A de-brand/rename, C native packaging, D finish the module refactor) are **out of scope here**.

## Scope

In scope: Main menu · Continue (progression save) · Pause · Settings (essentials) · debug-hook
hardening. **Out of scope:** de-brand/rename, native packaging, key remapping, music tracks.

## Architecture

Two new leaf modules under `core/` (live-exports model, consistent with the refactor in
progress), plus DOM additions in `index.html` and wiring in `main.js`. Menus are DOM overlays
(not WebGL) — cheapest, accessible, matches the existing `#intro`/`#bigmap` pattern.

### Component: `core/save.js`
- Persists **progression only** (world resets fresh each launch, so no world-seed problem).
- `localStorage` key `gta_save_v1`. Payload: `{ v:1, money:Number, owned:String[], ammo:{} }`.
- API:
  - `hasSave(): boolean` — a valid v1 record exists.
  - `loadProgress(): object|null` — parsed payload or null (corrupt/missing → null, never throws).
  - `saveProgress(data): void` — debounced (~1s) write; coalesces bursts.
- Depends on: nothing (pure browser API). Consumers call it; it doesn't import game state.

### Component: `core/settings.js`
- `localStorage` key `gta_settings_v1`. Defaults `{ volume:1, sensitivity:1, invertY:false, quality:'high' }`.
- API: `loadSettings(): object` (merged over defaults, never throws), `saveSettings(s): void`.
- Pure storage; applying the values is `main.js`'s job (see Data Flow).

### DOM (`index.html`)
- **Main Menu** — rework `#intro`: title + `[New Game]` `[Continue]` `[Settings]` buttons.
  `Continue` is `disabled` when `!hasSave()`. The controls table moves under a collapsible
  "How to play" `<details>`.
- **`#pause`** overlay (z45, hidden by default): `Resume` / `Settings` / `Quit to Menu`.
- **`#settings`** panel (z55), reused by both menus: Volume slider (0–1), Mouse sensitivity
  slider (0.3–2.0), Invert-Y checkbox, Graphics quality `<select>` (Low/Med/High), `Back`.
- Buttons are real DOM with `pointer-events:auto`; overlays use the existing `.hud`/overlay
  z-index conventions (overlays 30+, intro 50, error 99 — pause 45, settings 55).

## Data Flow

1. **Boot** (before `start()`): `loadSettings()` and read `hasSave()`. Apply settings immediately
   (so the menu itself honors volume etc.). Enable/disable `Continue`.
2. **`start(newGame)`**:
   - New Game → default progression (money 500, fists only) — current behavior.
   - Continue → `loadProgress()` then assign `money`, rebuild `owned`/`ammo`, refresh `weaponHUD()`.
   - Hides menu, `started=true`, `initAudio()`, request pointer lock (unchanged).
3. **Settings live-apply** (one `applySettings(s)` function called on boot and on every change):
   - `volume` → master gain node value.
   - `sensitivity` → multiplier on `movementX/Y` in the `mousemove` handler.
   - `invertY` → sign on the pitch delta.
   - `quality` → toggle composer passes & renderer:
     - **Low:** bypass composer (direct `renderer.render`), `shadowMap.enabled=false`, pixelRatio 1.
     - **Med:** bloom + SMAA, SSAO off, shadows on, pixelRatio ≤1.5.
     - **High:** bloom + SSAO + SMAA, shadows on, pixelRatio ≤2 (current behavior).
4. **Pause:** new `paused` flag.
   - Esc drops pointer lock natively → `pointerlockchange` listener: if `started && !bigOpen &&
     !paused` and lock was lost, set `paused=true` and show `#pause`.
   - `Resume` → hide overlay, `paused=false`, re-request pointer lock.
   - `Quit to Menu` → `paused=false`, `started=false`, show main menu, refresh `Continue`.
   - Loop: when `paused`, skip the simulation step but still `renderFrame()` (frozen scene),
     and reset `clock.getDelta()` accumulation so unpausing doesn't jump.
5. **Auto-save hooks:** call `saveProgress({money, owned, ammo})` (debounced) at the points
   money changes, `giveWeapon()` runs, and mission rewards pay out.

## Debug hardening

`window.__probe`/`window.__tp` attach **only** when
`location.hostname==='localhost' || location.search.includes('debug')`. Headless tests load
`http://localhost:8099/...` so they keep working; the public Pages build won't expose teleport
or the probe. The existing `// TEMP` diag fields stay inside `__probe` (only reachable under the
same gate). Cheat codes remain (intentional GTA-style feature).

## Error handling

- All `localStorage` reads are try/caught → fall back to defaults / null. A corrupt save never
  blocks boot.
- `localStorage` may be unavailable (private mode): `save.js`/`settings.js` degrade to in-memory
  no-ops; the game still runs, just without persistence.
- `applySettings` is defensive: unknown `quality` → treat as High.

## Testing (headless, `/tmp/gta_test`)

Extend `__probe` with `paused`, `settings` (the applied object), `hasSave`. New rig assertions:
- Main menu visible on load; `New Game` → `started===true`.
- Set money/own a weapon, reload page, `Continue` → money & arsenal restored.
- Change a setting, reload → setting persisted (`__probe().settings` matches).
- Trigger pause (simulate pointer-lock loss) → movement frozen (`px` unchanged under W).
- `quality='low'` runs without error (composer bypass path).
- All paths: `ERRORS: NONE` and `#err` not displayed.

## Out of scope (explicit)

De-brand/rename (A), native/offline packaging (C), key remapping, music. Tracked separately.
