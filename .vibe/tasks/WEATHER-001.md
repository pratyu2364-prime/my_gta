id: WEATHER-001
title: Rain weather — periodic rain with visuals + wet handling
phase: 5
depends_on: none
status: done
attempts: 3
acceptance:
 - A weather state machine cycles clear → rain → clear on randomized timers (rain roughly every 2-5 min, lasting 40-90s), independent of time-of-day.
 - During rain: visible falling rain streaks around the camera (ONE THREE.Points or LineSegments object, ~400-800 particles recycled in a box that follows the player — no per-frame allocation), sky/ambient dimmed and fog thickened versus the current tod-driven values, and a subtle wet-road look (darker ground or lowered ground material brightness) — all fully reverting when rain ends (smooth fade in/out, no pop).
 - Wet handling: while raining, player vehicle lateral grip damping is reduced (more slide/drift) by a modest factor; on-foot movement unchanged; AI cars unchanged.
 - New cheat code RAIN toggles rain on/off instantly (for testing), alongside RICH/CLEAN/HOT.
 - Rain must not fight the day/night system: it multiplies/offsets the existing tod-derived sky/fog/light values rather than overwriting them, so night rain and day rain both look right.
 - No measurable perf collapse (single draw call for rain; reuse geometry/material).
 - Game boots clean; node scripts/playtest.cjs passes and CI is green.
files: [src/main.js]
notes: |
  Day/night: tod (0..1, 8 min/day), dayF, night drive sky lerp/fog/emissives — find the
  per-frame block that sets sky/fog from tod and apply a rain factor there (e.g.
  rainF 0..1 eased; fog.density *= 1+rainF*k; light intensities *= 1-rainF*.4).
  Cheats live in the CHEATS map ~1384 (RICH/CLEAN/HOT) — add RAIN there.
  Player grip: velocity is decomposed into forward/lateral with lateral damping =
  drift (see Player row in CLAUDE.md; decay uses Math.pow(k, dtF)) — scale the lateral
  grip constant toward 1 by rainF*~0.35. Rain particles: allocate once at init, hide
  via visible=false when clear; each frame move points down and wrap into a box
  centred on player (x,z ±40, y 0..30). Keep compact style; one PR.
