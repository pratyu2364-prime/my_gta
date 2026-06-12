# CLAUDE.md — context for working on this project

## What this is

A GTA-style open-world game in **one file: `gta_sim.html`** (~1100 lines). Plain three.js
r128 loaded from unpkg CDN. No build step, no package.json, no modules — everything lives
in a single `<script>` inside `main()`. Keep it that way unless the user asks otherwise.

## Owner preferences

- **Token-frugal**: prefer one well-planned large Write/Edit batch over many small
  iterations. Test once at the end, not repeatedly.
- Full autonomy granted — build and report, don't ask clarifying questions.

## Architecture (order matters — sections appear in this sequence in the file)

| System | Key symbols | Notes |
|---|---|---|
| Road network | `cityX`, `cityZ`, `genAxis`, `trimAxis`, `inters` | Lines are `{c, a, b, cross[]}` — `c` = coordinate, `[a,b]` = extent (partial roads dead-end), `cross` = intersecting line objects. Asymmetric, regenerated each load. |
| Ground | `paintCity(ctx,S,mini)` | Paints the ENTIRE city (roads, sidewalks, markings, crosswalks) onto one canvas — used at 2048px as the ground texture AND at 720px as the minimap image. Edit roads → edit this one function. |
| Buildings | `blocks[]`, `colliders[]` | `colliders` are AABBs `{x0,x1,z0,z1}` used by ALL collision. |
| Vehicles | `makeCar(color,cop)`, `makeBike(color)` | `userData = {wheels, hp, type:'car'|'bike', rad, paint, door?, lean?, beacons?}`. The car's `door` group is hinged at its front edge; swing = `rotation.y` 0→1.15. |
| Peds | `makePed(cop)`, `pose(mesh,seated)`, `peds[]` | Limbs in `userData.limbs`; walk anim = sin swings. |
| Player | `player{x,z,vx,vz,heading,inCar,steer}`, `char`, `vehicle` | `player.x/z` is ALWAYS current position (synced in-car). Physics: velocity decomposed into forward/lateral; lateral grip damping = drift. |
| Carjack | `jack`, `startJack/jackUpdate/finishJack`, `doors[]`, `openDoor` | State machine: walk → open (door anim) → pull (occupant thrown via `thrownPed`) → in. AI car gets `ai.jacked=true` (freezes it). |
| Traffic AI | `aiCars[]`, `aiUpdate` | Cars follow line objects, turn at `cross` lines, U-turn at extent ends, obey `lightState(axis)`, brake for player + peds. `ai.occupant` = visible driver/rider. |
| Police | `cops[]` (cruisers), `footCops[]`, `copUpdate`, `footCopUpdate` | Busting ONLY happens when a foot-cop reaches within 1.5u of a slow/on-foot player. Cruisers deploy officers when close & player slow. |
| Weapons | `WEAPONS`, `owned`, `ammo`, `bullets[]`, `shoot()` | Bullets advance 3 substeps/frame vs tunneling. `pickups[]` respawn 30s after collection. |
| Day/night | `tod` (0..1, 8 min/day), `el`, `dayF`, `night` | Drives sky lerp, `bldMats`/`headMat`/`lampHead` emissive, `stars` opacity, `hlights` (player headlight SpotLights). |
| UI | `weaponHUD`, `updateStars`, `hitFlash/vigO`, `drawMinimap` | Minimap rotates by `player.heading - π`; blips drawn inside the transformed context. |

## Gotchas (learned the hard way)

- **E key is edge-triggered** via `pressedE` set in keydown — polling `keys.KeyE` misses
  fast taps between frames. Keep one-shot actions edge-triggered.
- `dt` is clamped to 0.05s; additive physics scale by `dtF = dt*60`, decay uses
  `Math.pow(k, dtF)`. At very low FPS the game slows rather than explodes.
- In `aiUpdate`, position must be applied with the OLD axis before the turn logic mutates
  `ai.axis` (was a real bug once).
- Building materials are SHARED (`bldMats`) — per-frame emissive tweaks are cheap, but
  never mutate them per-building.
- `forward = (sin θ, 0, cos θ)` for `rotation.y = θ`. Minimap N-marker / rotation math
  derives from map-x = world-x, map-y = world-z.
- Audio nodes may fail to init — always guard with `if(actx && eng.g)`.
- `vehicle.children[0]` is the body mesh (used by the lean animation) — keep the body as
  the first child added in `makeCar`.

## Testing (headless)

Harness lives in `/tmp/gta_test` (recreate if gone):

- chrome-headless-shell was installed manually because the system lacks `unzip`:
  download the zip from `storage.googleapis.com/chrome-for-testing-public/<ver>/linux64/`
  and extract with `python3 -m zipfile -e` into `~/.cache/puppeteer/chrome-headless-shell/`.
- `npm install puppeteer-core puppeteer` with `PUPPETEER_SKIP_DOWNLOAD=1`.
- Launch args: `--no-sandbox --enable-unsafe-swiftshader --use-gl=angle --use-angle=swiftshader`.
- Test pattern: load `file://…/gta_sim.html`, listen for `pageerror`/console errors, press
  a key to start, simulate KeyE/KeyW/KeyA, snapshot DOM HUD state
  (`#speedo, #prompt, #zone, #weapon`) and take screenshots, assert `NO JS ERRORS`.
- Headless FPS is ~10, so allow 2× real-time for timed sequences (e.g. the carjack).
- Quick syntax check without a browser:
  `node -e "new Function(require('fs').readFileSync('gta_sim.html','utf8').match(/<script>([\s\S]*?)<\/script>/g).pop().replace(/<\/?script>/g,''))"`.

## Conventions

- Compact style: short names, semicolon-terminated lines, sections marked with
  `// ---------- name ----------` banners. Match it.
- New HUD elements: fixed-position divs with `.hud` class or explicit z-index ≤ 25
  (overlays 30+, intro 50, error 99).
- All world constants up top (`WORLD=450`, `ROAD_W=14`, `HALF=10`, `LANE=3.4`).
