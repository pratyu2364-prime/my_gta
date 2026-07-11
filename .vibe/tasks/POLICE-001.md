id: POLICE-001
title: Wanted escalation tiers — police pressure scales with stars
phase: 5
depends_on: none
status: todo
attempts: 0
acceptance:
 - Behaviour at 0-2 stars is unchanged from today (regression guard — current chase/arrest/deploy logic stays as-is at low wanted).
 - At 3+ stars pursuing cruisers get aggressive: higher pursuit top speed and they actively steer to ram the player's vehicle (contact should feel like a hit — reuse existing collision/damage path, no new damage system).
 - At 4+ stars hostile foot cops fire faster (shorter fireT) and hit harder (higher per-bullet dmg passed to shoot), and the max simultaneous pursuing cruisers cap rises (e.g. 2 → 4).
 - At 5 stars pressure is maxed: cap +1 more cruiser and cruisers respawn/deploy faster.
 - All tier thresholds keyed off the existing `wanted` var; escalation effects end when wanted drops (CLEAN cheat returns everything to calm).
 - Testable via HOT cheat (sets 5 stars): after HOT, more cruisers converge and ram; after CLEAN, pursuit stops.
 - Game boots clean; node scripts/playtest.cjs passes and CI is green.
files: [src/main.js]
notes: |
  Police lives in: cops[] cruisers + copUpdate, footCops[] + footCopUpdate, copWalkers
  (hostile pursuit block ~1692: wanted>0&&d<55, fires when wanted>=2 with fireT=.7 and
  shoot(...,'cop',10) — scale .7→~.45 and 10→~16 at wanted>=4). Cruiser pursuit spawn/cap
  logic is in the wanted&&police block ~2787 — find the cap constant and make it
  tier-dependent (2/3★, 4/4★, 5/5★). Ram: when wanted>=3 and cruiser is within ~12u of
  the player's vehicle, steer directly at player position and drop braking; existing
  car-vs-player collision already applies damage. Do NOT touch arrest logic
  (footCop.arrestT) or the busting rules. Keep compact style; one PR.
