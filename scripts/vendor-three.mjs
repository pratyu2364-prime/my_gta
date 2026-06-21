// Vendors three.js r128 + the addon dependency closure into ./vendor/three/,
// mirroring unpkg's path layout so relative imports (incl. ../../../build) resolve locally.
// Run once: node scripts/vendor-three.mjs   (needs network)
import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';

const VER='0.128.0';
const ROOT=path.resolve('vendor/three');
const get=url=>new Promise((res,rej)=>{https.get(url,r=>{
  if(r.statusCode>=300&&r.statusCode<400&&r.headers.location){return get(new URL(r.headers.location,url).href).then(res,rej);}
  if(r.statusCode!==200)return rej(new Error(r.statusCode+' '+url));
  let d='';r.on('data',c=>d+=c);r.on('end',()=>res(d));
}).on('error',rej);});
const save=(rel,txt)=>{const f=path.join(ROOT,rel);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,txt);};

const seen=new Set();
async function fetchModule(rel){              // rel is a path under vendor/three/, e.g. examples/jsm/postprocessing/X.js
  if(seen.has(rel))return;seen.add(rel);
  const txt=await get(`https://unpkg.com/three@${VER}/${rel}`);
  save(rel,txt);
  const re=/(?:import|export)[^'"]*?from\s*['"]([^'"]+)['"]|import\s*['"]([^'"]+)['"]/g;
  let m;const deps=[];
  while((m=re.exec(txt))){const spec=m[1]||m[2];if(spec&&(spec.startsWith('./')||spec.startsWith('../')))deps.push(spec);}
  for(const spec of deps){
    const resolved=path.posix.normalize(path.posix.join(path.posix.dirname(rel),spec));
    if(!resolved.startsWith('examples/jsm/'))continue;   // escapes jsm (e.g. ../../../build) → handled separately
    await fetchModule(resolved);
  }
}

(async()=>{
  fs.mkdirSync(ROOT,{recursive:true});
  console.log('build/three.module.js …');
  save('build/three.module.js',await get(`https://unpkg.com/three@${VER}/build/three.module.js`));
  const entries=[
    'examples/jsm/loaders/RGBELoader.js','examples/jsm/loaders/GLTFLoader.js',
    'examples/jsm/postprocessing/EffectComposer.js','examples/jsm/postprocessing/RenderPass.js',
    'examples/jsm/postprocessing/ShaderPass.js','examples/jsm/postprocessing/UnrealBloomPass.js',
    'examples/jsm/postprocessing/SSAOPass.js','examples/jsm/postprocessing/SMAAPass.js',
  ];
  for(const e of entries)await fetchModule(e);
  console.log('vendored',seen.size,'jsm modules +1 build →',ROOT);
})().catch(e=>{console.error('FAIL',e.message);process.exit(1);});
