# GTA Asset Pipeline Refactor — Design

**Date:** 2026-06-14
**Status:** Approved
**Owner:** Pratyush

## Goal

Remove the project's defining limitation — that a single procedural HTML file can't
reach high visual fidelity — by refactoring into a maintainable modular static project
that loads **authored CC0 3D assets** (glTF/GLB models, PBR textures, HDRI environments).
Preserve all existing gameplay throughout. **Every phase ends with an end-to-end deploy
to GitHub Pages.**

## Decisions (locked)

- **Asset source:** free/CC0 libraries — Quaternius, Kenney, Poly Haven, Sketchfab CC0.
  Realistic ceiling: polished stylized / semi-realistic (not literal GTA V).
- **Tooling:** NO build step. Modern ES modules via an **import map** from a CDN; asset
  files committed to the repo. Deploy stays "push → Pages serves files."
- **three.js:** switch to the **r128 ES-module build** (`three.module.js` + `examples/jsm/...`)
  to keep the current API stable while unlocking loaders and modules. Postprocessing moves
  from `examples/js` globals to `jsm` imports.
- **Strategy:** incremental modular refactor; swap procedural meshes for GLB category by
  category; deploy after each step.

## Target architecture

```
index.html          thin shell: canvas, HUD DOM, loading screen, import map, <script type=module>
src/
  main.js           bootstrap + game loop, wires systems
  core/   engine.js (renderer/scene/camera/postfx) · input.js · assets.js · audio.js
  world/  city.js · terrain.js · buildings.js · props.js
  entities/ vehicles.js · characters.js · traffic.js · police.js · peds.js
  gameplay/ player.js · weapons.js · carjack.js · missions.js
  ui/     hud.js · minimap.js
assets/  models/ (GLB) · textures/ · hdri/
manifest.json       declarative asset list
```

Modules communicate through explicit imports/exports and a shared game-state object passed
to update functions. No globals beyond the engine singletons.

## Asset pipeline (`core/assets.js`)

- `AssetManager` wraps `GLTFLoader` (+ `DRACOLoader`, `KTX2Loader`), exposes promise-based
  `loadAll(manifest)`, caches loaded gltf scenes, and provides `spawn(id)` that clones.
- A loading screen (reuse the existing intro overlay) shows a progress bar driven by the
  loader's `onProgress`; the game loop starts only after assets resolve.
- HDRI environment loaded via Poly Haven's public API (direct file URLs, no zip) → drives
  `scene.environment` (replacing the current procedural PMREM) and optionally the sky.

## Migration phases (each deploys end-to-end)

1. **Scaffold** — split the file into the module layout above; switch to three ESM via
   import map; postprocessing via jsm. ZERO visual/gameplay change. Verify identical, deploy.
2. **Pipeline + HDRI** — add `AssetManager` + loading screen; real HDRI environment/sky.
3. **Vehicles** → GLB, preserving the `userData` contract (wheels, rad, door, lean, beacons,
   body child[0] for lean anim).
4. **Characters / crowd** → GLB (player, foot-cops, occupants, instanced crowd).
5. **Buildings** → modular GLB city kit (instanced for scalability).
6. **Props / trees** → GLB.

Gameplay preserved every step: traffic AI, police, carjack, weapons, missions, day/night,
minimap, talk, landmarks, terrain (river/bridges/mountains/forest).

## Testing & local runs (consequence of ES modules)

ES modules + asset `fetch` **break `file://`** in Chrome. Therefore:
- **Production unaffected** — Pages serves over https.
- **Local + headless testing now requires a static server** (`python3 -m http.server`);
  the puppeteer harness in `/tmp/gta_test` is updated to load `http://localhost:<port>`.
- Each phase: serve locally, run the headless smoke test (no JS errors, `#err` hidden,
  screenshots), then commit + push to deploy.

## Risks & mitigations

- **`file://` breakage** → use a local http server for tests (above).
- **Asset licensing** → CC0 / Kenney / Quaternius / Poly Haven only; keep an
  `assets/CREDITS.md` listing sources + licenses.
- **Repo size from binaries** → prefer Draco/KTX2-compressed GLB; keep the asset set lean.
- **Big-bang breakage** → strictly incremental; the game stays playable and deployed after
  every phase. Scaffold phase changes structure only, not behavior, to isolate regressions.
- **three ESM API drift** → pin r128 module build to match current API exactly.

## Out of scope (for now)

Multiplayer, a bundler/CI, authored (non-CC0) art, physics-engine replacement.
