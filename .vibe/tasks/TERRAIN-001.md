id: TERRAIN-001
title: Deliberate, well-spaced river bridges (not random/sparse)
phase: 3
depends_on: none
status: done
attempts: 0
acceptance:
 - The river always has a sensible number of crossings (target ~3, scaled to river length), spaced roughly evenly along z and kept clear of the spawn band — never zero, never absurdly clustered.
 - Each crossing is a real road that fully spans the river band (so a bridge deck is built on it by the existing river.cross logic) AND has drivable road approaches reaching BOTH banks — no bridge deck without a road leading onto it from each side.
 - Approach roads are drawn by paintCity (so the baked ground texture AND the minimap show them) — the bridge is not a floating deck over blank water.
 - Bank colliders still leave gaps ONLY at the final crossing set (the seg/gaps logic must use the same crossing z-list that decks are built from).
 - No regressions: traffic AI still drives the network, game boots clean. `node scripts/playtest.cjs` passes and CI is green.
files: [src/main.js]
notes: |
  Root cause: river.cross (src/main.js ~line 196) = whichever cityZ roads happen to
  fully span the river band (W.a<x0-2 && W.b>x1+2). Because the road grid is asymmetric/
  partial, that set is arbitrary and often sparse → bridges feel random.
  Cleanest fix: GUARANTEE ~3 evenly-spaced horizontal roads that fully span the river band,
  inserted into cityZ at road-generation time (BEFORE paintCity bakes the ground at ~line 234
  and before river.cross is computed at ~196), avoiding |z-spawnZ|<~70. Then the existing
  river.cross → bank-gap (~495) → deck/rail (~509) pipeline yields well-spaced bridges with
  real approaches and correct minimap, no separate special-casing.
  ORDERING IS CRITICAL (see CLAUDE.md): river is computed at ~183, paintCity bakes at ~234,
  banks/decks at ~467 — added spanning roads must exist in cityZ before all of those.
  Integrate added roads with the line `cross[]` intersection arrays like any other road so
  traffic AI and lights still work. Compact style. If full road-gen integration proves too
  large for one PR, split: (a) guarantee spanning roads, (b) bridge/bank wiring — flag it.
