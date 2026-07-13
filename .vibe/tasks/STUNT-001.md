id: STUNT-001
title: Stunt air bonuses — cash + message for big vehicle air time
phase: 8
depends_on: none
status: todo
attempts: 0
acceptance:
 - While driving a car/bike/auto (not plane/heli), leaving the ground (vehicle y above ground for >0.6s continuous) starts an air timer; landing (back to ground) with airtime >= 0.6s awards a bonus: money += round(airtime * 250), showMsg('✈ STUNT +$'+amt) and chime(). Below the threshold: nothing.
 - Landing that flips into a crash/explosion still awards nothing extra beyond existing behaviour (no double effects) — award only on a survivable landing (vehicle not dead).
 - No award spam: after an award, a 2s cooldown before a new air timer can start.
 - Uses existing vehicle vertical state only — do not add new physics; detect air via the vehicle's y position / existing airborne flags for cars. If cars have no y-motion (only the flyover ramp launches them), key off vehicle.position.y > 0.5 above ground.
 - Game boots clean; node scripts/playtest.cjs passes and CI is green.
files: [src/main.js]
notes: |
  Flyover/ramps in stuntZone (~372-385, buildFlyover 592) already launch vehicles;
  car y handling lives in the in-car physics block of animate (vehicle.position.y,
  vertical velocity when coming off ramps). chime() + showMsg exist. money HUD updates
  automatically. Guard types: vehicle.userData.type in ('car','bike','auto').
  Keep compact style; one PR.
