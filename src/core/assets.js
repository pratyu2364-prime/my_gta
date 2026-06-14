// AssetManager — promise-based loading + caching for the asset pipeline.
// Phase 2: HDRI environment. Phases 3-6 add GLB models via loadGLTF/spawn.
import * as THREE from 'three';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export class AssetManager {
  constructor(renderer){
    this.renderer = renderer;
    this.gltf = new GLTFLoader();
    this.rgbe = new RGBELoader();
    this.models = {};          // id -> loaded gltf scene (prototype to clone)
  }
  // equirectangular .hdr -> prefiltered PMREM env texture (reflections + ambient)
  loadHDRI(url){
    return new Promise((resolve, reject) => {
      this.rgbe.load(url, tex => {
        const pmrem = new THREE.PMREMGenerator(this.renderer);
        const env = pmrem.fromEquirectangular(tex).texture;
        tex.dispose(); pmrem.dispose();
        resolve(env);
      }, undefined, reject);
    });
  }
  // load a GLB and cache its scene under id; returns the gltf
  loadGLTF(id, url){
    return new Promise((resolve, reject) => {
      this.gltf.load(url, gltf => { this.models[id] = gltf.scene; resolve(gltf); }, undefined, reject);
    });
  }
  // clone a previously loaded model for spawning (shares geometry/materials)
  spawn(id){
    const proto = this.models[id];
    return proto ? proto.clone(true) : null;
  }
}
