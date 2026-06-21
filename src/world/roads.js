// world/roads.js — asymmetric road network (pure data, no scene/THREE render coupling).
// Lines are objects {c:coordinate, a:start, b:end, cross:[lines]} — some roads are partial (dead ends).
// Regenerated each load. (Stage 1 of the incremental split out of main.js.)
import { WORLD } from '../core/constants.js';
import { rnd } from '../core/math.js';

export function buildRoadNetwork() {
  function genAxis() {
    const l = []; let c = -WORLD + rnd(40, 80);
    while (c < WORLD - 100) { l.push({ c, a: -WORLD + 10, b: WORLD - 10, cross: [] }); c += rnd(55, 150); }
    return l;
  }
  const cityX = genAxis(), cityZ = genAxis();
  const midX = Math.floor(cityX.length / 2), midZ = Math.floor(cityZ.length / 2);
  function trimAxis(axis, other, skip) {
    for (let i = 0; i < axis.length; i++) {
      if (i === skip || Math.random() >= .34) continue;
      const cs = other.map(o => o.c);
      let i0 = Math.floor(Math.random() * (cs.length - 2));
      let i1 = i0 + 2 + Math.floor(Math.random() * (cs.length - i0 - 2));
      if (i1 >= cs.length) i1 = cs.length - 1;
      if (cs[i1] - cs[i0] < 140) continue;
      if (Math.random() < .5) axis[i].a = cs[i0]; else axis[i].b = cs[i1];
      if (Math.random() < .3) { axis[i].a = cs[i0]; axis[i].b = cs[i1]; }
    }
  }
  trimAxis(cityX, cityZ, midX); trimAxis(cityZ, cityX, midZ);
  function computeCross() {
    for (const L of cityX) L.cross = cityZ.filter(W => W.c >= L.a - 1 && W.c <= L.b + 1 && L.c >= W.a - 1 && L.c <= W.b + 1);
    for (const W of cityZ) W.cross = cityX.filter(L => L.c >= W.a - 1 && L.c <= W.b + 1 && W.c >= L.a - 1 && W.c <= L.b + 1);
  }
  computeCross();
  for (const L of cityX.concat(cityZ)) if (L.cross.length < 2) { L.a = -WORLD + 10; L.b = WORLD - 10; }
  computeCross();
  const inters = [];
  for (const L of cityX) for (const W of L.cross) inters.push({ x: L.c, z: W.c });
  const spawnX = cityX[midX].c, spawnZ = cityZ[midZ].c;
  return { cityX, cityZ, midX, midZ, inters, spawnX, spawnZ };
}
