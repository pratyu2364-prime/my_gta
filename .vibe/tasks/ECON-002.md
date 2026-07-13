id: ECON-002
title: Pay-N-Spray landmark — drive in to clear wanted + repaint/repair for cash
phase: 6
depends_on: none
status: done
attempts: 1
acceptance:
 - A 4th landmark "PAY-N-SPRAY" is placed on its own special block like the existing 3 (hospital/police/food): built via the LM config array (~line 358) + buildLandmark, with sign, blip on minimap, and a doorway gap wide enough to drive a car through (widen the gap for this type only).
 - Driving INTO the landmark footprint while in a car (player.inCar, type 'car' or 'auto' — not bikes) with money >= 400 triggers the spray: money -= 400, wanted cleared (reuse the CLEAN path: wanted=0, wantedTimer=0, updateStars(), clearCops()), vehicle hp restored to full, and the car body repainted a random new color (body mesh is vehicle.children[0]; its material color + userData.paint).
 - A short "spraying" beat: player input locked ~2s with a message ('Spraying…' then '🎨 Sprayed! Heat lost'), screen can just use existing showMsg — no new UI systems.
 - If money < 400, show a rejection message once (not every frame) and nothing happens.
 - Cooldown: cannot re-trigger for 10s after a spray (prevents money drain while parked inside).
 - Existing 3 landmarks unaffected; heal zones still work.
 - Game boots clean; node scripts/playtest.cjs passes and CI is green.
files: [src/main.js]
notes: |
  LM config array ~358, chosen.forEach → buildLandmark ~367 (picks special blocks;
  extend selection to 4 blocks). checkLandmarks runs every non-dead frame and already
  does zone checks vs landmark footprints (heal logic) — add the spray check there.
  clearCops ~1746; CLEAN cheat ~1416 shows the exact wanted-clear sequence.
  Money HUD updates via existing money var + its HUD updater. Input lock: reuse
  whatever busted/dead sequences use to freeze input, or gate the player-control
  block on a sprayT timer. Keep compact style; one PR.
