id: TERRAIN-002
title: Natural rolling hills replace the decorative cone-mountain ring
phase: 3
depends_on: none
status: todo
attempts: 0
acceptance:
 - The decorative mountain ring (src/main.js ~lines 589-602, ConeGeometry cones) is replaced with natural-looking rolling hills — irregular, rounded, varied-height silhouettes (vertex-displaced / noise-based geometry, NOT 4-sided spikes).
 - Natural colouring: an earthy grass→rock gradient, with optional snow only on the tallest peaks; lit by the existing scene lights (use a material that responds to lighting, like the existing MeshPhong, so day/night still affects them).
 - Purely decorative and non-interactive: positioned in a ring BEYOND the playable area (similar radius to the current ~540-660), NO colliders, no groundHeightAt entries, no gameplay change.
 - Performance stays cheap: keep total added geometry modest (instancing or a handful of merged meshes); must not noticeably drop FPS.
 - Game boots clean; `node scripts/playtest.cjs` passes and CI is green; a screenshot shows natural hills on the horizon instead of spiky cones.
files: [src/main.js]
notes: |
  Current code builds N=30 ConeGeometry(br,h,4..8,1) cones in a ring with snow caps on tall
  ones. Replace with rounded hills — e.g. low-poly displaced IcosahedronGeometry/SphereGeometry
  half-buried, or a PlaneGeometry/ring with per-vertex noise height, flatShading optional for a
  stylised look that matches the game. Keep the snow-cap idea for the tallest. Do NOT add colliders
  or height-field entries (these are background scenery). Match the compact code style. Self-contained
  visual change — good single-PR task.
