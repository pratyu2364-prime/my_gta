// core/math.js — pure math/random helpers shared across systems.
// (Stage 0 of the incremental split out of main.js.)
import * as THREE from 'three';
export const M = THREE.MathUtils;
export const rnd = (a, b) => a + Math.random() * (b - a);
export const pick = a => a[Math.floor(Math.random() * a.length)];
