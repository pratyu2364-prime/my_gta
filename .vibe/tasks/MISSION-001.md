id: MISSION-001
title: Taxi fares — pick up waiting peds, drive them to a marker for cash
phase: 7
depends_on: none
status: todo
attempts: 0
acceptance:
 - New TAXI cheat starts taxi mode (like RACE/COURIER, CHEATS map ~1423); requires being in a car or auto, else shows a message and does not start.
 - Taxi mode: a fare ped is highlighted with the existing marker style (see courier.marker) at a random sidewalk spot 60-150u away; drive within 6u and stop (speed <.15) → ped "boards" (despawn/recycle the ped record in place, never splice peds[]), then a destination marker appears 80-200u away.
 - Reaching the destination within the time limit (scaled to distance, ~dist/0.28 frames worth of seconds — generous) pays a fare (150 + distance-scaled bonus) and immediately offers the next fare; missing the timer or exiting the vehicle ends taxi mode with a message.
 - HUD reuses the existing race/courier timer/message pattern (showMsg + a small timer readout if one exists — no new UI systems).
 - Repeatable: TAXI again restarts; state fully resets (marker hidden, timers cleared).
 - Game boots clean; node scripts/playtest.cjs passes and CI is green.
files: [src/main.js]
notes: |
  Model everything on startCourier/courierUpdate/endCourier (~2053-2075): same marker
  object pattern, same update hook call site in animate. Fare pickup ped: pick a ped
  record from peds[] near the target spot or just place the marker on a sidewalk point
  (sidewalk points can be sampled the way spawnPed does). Recycling rule: instance
  index = array index, respawn in place — see CLAUDE.md Crowd row. Timer: courier.time
  pattern. Exit-vehicle detection: player.inCar false while taxi active → fail.
  Keep compact style; one PR.
