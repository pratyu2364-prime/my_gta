id: LIFE-002
title: Day/night crowd density — sparser streets at night
phase: 4
depends_on: none
status: done
attempts: 0
acceptance:
 - The number of ACTIVE wandering peds varies with time of day via the existing `tod` (0..1) / `night` / `dayF` system: busier in daytime, noticeably sparser late night, smooth transition (no popping a whole crowd in/out in one frame).
 - Implemented within the existing instanced-crowd system (peds[] data records + InstancedMeshes). Do NOT change MAXP or splice peds — instead drive a target active-count and ease toward it: hide/show surplus peds by parking them (e.g. set far offscreen / scale 0 in the instance matrix or skip their update) rather than removing array entries. Index = array index MUST stay stable.
 - Performance unchanged or better at night (fewer active peds); no flicker, no NaN matrices.
 - Game boots clean; node scripts/playtest.cjs passes and CI is green.
files: [src/main.js]
notes: |
  See CLAUDE.md crowd section: peds[] are data records, 8-9 InstancedMeshes, updateCrowd()
  composes matrices from scratch; NEVER splice(peds) (instance index = array index). tod is
  0..1 (8 min/day), `night` boolean, `dayF` day-factor already drive lighting. Compute a
  target active count from dayF (e.g. lerp between a low night count and the full start count),
  ease the active count, and for inactive peds collapse their instance (scale 0 / move below
  ground) so they render cheaply and don't walk around. Keep setColorAt/colorsDirty behavior
  intact. Compact style.
