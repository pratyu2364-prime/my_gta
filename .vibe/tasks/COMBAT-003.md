id: COMBAT-003
title: AI traffic takes bullet damage and can be destroyed
phase: 5
depends_on: COMBAT-002
status: todo
attempts: 0
acceptance:
 - Player bullets hitting an AI vehicle (bullet loop ~line 2773: `for(const a of aiCars)if(...<2){sparks...}`) now also subtract b.dmg from that vehicle's hp (`a.mesh.userData.hp`, already initialized by makeCar/makeBike/makeRickshaw — guard with a fallback of 40 if undefined).
 - The existing panic reaction stays (sparks + a.base speed-up).
 - When hp<=0: explode(a.mesh.position) (~line 1913), remove the mesh from the scene, remove the record from aiCars (splice is SAFE here — aiCars is not instanced), and spawnAI() a replacement so traffic density holds.
 - Destroying a vehicle is a crime: addWanted(1) guarded by the existing crimeCool pattern (see ped-hit branch ~line 2739: `if(crimeCool<=0){addWanted(1);crimeCool=2;}`).
 - Occupant goes with the car (it is a child of the mesh) — no orphaned drivers, no crash if a.occupant references it.
 - Do NOT let cop bullets damage AI traffic; player bullets only. Jacked (frozen) cars are damageable like any other.
 - Game boots clean; node scripts/playtest.cjs passes; CI green.
files: [src/main.js]
notes: |
  Today shooting traffic just sparks + spooks it — cars are indestructible. explode()
  already handles fireball/shockwave and (via LIFE-001) scatters the crowd. Police AI
  cruisers in traffic (a.police) explode like the rest but killing one should use
  addWanted(2) to match the direct-cruiser-kill precedent (~line 2766). Match compact
  style; no physics/pathing changes.
