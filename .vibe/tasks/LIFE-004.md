id: LIFE-004
title: Rain affects street life — crowd thins and hurries, traffic cautious
phase: 6
depends_on: none
status: done
attempts: 1
acceptance:
 - While raining (rainF from WEATHER-001), the wandering crowd target density scales down by up to ~60% at full rain (multiply the existing crowd target `tgt` ~line 1097 by (1-rainF*.6)) — smooth, no pops, recovers when rain ends.
 - Remaining walking peds hurry in rain: walk speed and swing-anim rate scale up ~1.5x with rainF (walking peds only — talk/down/flee states untouched).
 - AI traffic is cautious in rain: AI car cruise speed scales down ~20% with rainF (aiUpdate), brake-light behaviour unchanged.
 - Zero new draw calls or allocations; all effects are per-frame multipliers off existing values, keyed off rainF, fully reverting when clear.
 - RAIN cheat demonstrates all three effects immediately.
 - Game boots clean; node scripts/playtest.cjs passes and CI is green.
files: [src/main.js]
notes: |
  rainF is the global 0..1 eased rain factor (WEATHER-001). Crowd density target
  computed near line ~1095-1097 (crowdActive chases tgt; LIFE-002 already scales it
  by day/night — multiply the same tgt). Ped walk: updateCrowd moves peds by a speed
  constant and advances p.sw for the swing — scale both by (1+rainF*.5) for state
  'walk' only. AI cars: aiUpdate has a target/cruise speed — multiply by (1-rainF*.2).
  Keep compact style; one PR.
