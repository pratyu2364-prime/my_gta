id: LIFE-003
title: AI traffic lights its brake lights when braking
phase: 4
depends_on: none
status: done
attempts: 0
acceptance:
 - AI cars glow their rear brake lights (the existing per-car userData.brakeMat) when decelerating/braking — e.g. when their target speed is below current speed or they're stopping for lights/traffic/the player — and dim them otherwise, matching the player look (emissiveIntensity ~2.4 braking, ~.4 normal).
 - Guard for vehicles without a brakeMat (bikes/auto-rickshaws may not have one) — only cars light up; no crash on missing brakeMat.
 - Purely visual; no change to AI driving/path/speed logic.
 - Game boots clean; node scripts/playtest.cjs passes and CI is green.
files: [src/main.js]
notes: |
  Brake lights are currently driven ONLY for the player (src/main.js ~line 2563:
  vehicle.userData.brakeMat.emissiveIntensity=(k.dn||k.hb)?2.4:.4). AI cars build a
  brakeMat (~801/835) but never light it. In aiUpdate, right after `ai.cur` is updated
  (~line 1550 `ai.cur+=M.clamp(target-ai.cur,...)`), set the car's brakeMat emissive from
  whether it's braking: braking when target < ai.cur - small epsilon (and/or target≈0).
  Use ai.mesh.userData.brakeMat (guard it exists). Match compact style. Visual only.
