// GTA — Bharat Version. ESM entry (Phase 1 scaffold of the asset-pipeline refactor).
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { AssetManager } from './core/assets.js';

function showError(m){document.getElementById('err').style.display='flex';document.getElementById('errmsg').textContent=m;}
try{main();}catch(e){showError(e.message+'\n'+(e.stack||''));}

function main(){
'use strict';
const M=THREE.MathUtils;
const rnd=(a,b)=>a+Math.random()*(b-a), pick=a=>a[Math.floor(Math.random()*a.length)];

// ---------- world constants ----------
const WORLD=450;
const ROAD_W=14, SIDE=3, HALF=ROAD_W/2+SIDE;
const LANE=3.4;

// ---------- asymmetric road network ----------
// lines are objects {c:coordinate, a:start, b:end, cross:[lines]} — some roads are partial (dead ends)
function genAxis(){
  const l=[];let c=-WORLD+rnd(40,80);
  while(c<WORLD-100){l.push({c,a:-WORLD+10,b:WORLD-10,cross:[]});c+=rnd(55,150);}
  return l;
}
const cityX=genAxis(), cityZ=genAxis();
const midX=Math.floor(cityX.length/2), midZ=Math.floor(cityZ.length/2);
function trimAxis(axis,other,skip){
  for(let i=0;i<axis.length;i++){
    if(i===skip||Math.random()>=.34)continue;
    const cs=other.map(o=>o.c);
    let i0=Math.floor(Math.random()*(cs.length-2));
    let i1=i0+2+Math.floor(Math.random()*(cs.length-i0-2));
    if(i1>=cs.length)i1=cs.length-1;
    if(cs[i1]-cs[i0]<140)continue;
    if(Math.random()<.5)axis[i].a=cs[i0];else axis[i].b=cs[i1];
    if(Math.random()<.3){axis[i].a=cs[i0];axis[i].b=cs[i1];}
  }
}
trimAxis(cityX,cityZ,midX);trimAxis(cityZ,cityX,midZ);
function computeCross(){
  for(const L of cityX)L.cross=cityZ.filter(W=>W.c>=L.a-1&&W.c<=L.b+1&&L.c>=W.a-1&&L.c<=W.b+1);
  for(const W of cityZ)W.cross=cityX.filter(L=>L.c>=W.a-1&&L.c<=W.b+1&&W.c>=L.a-1&&W.c<=L.b+1);
}
computeCross();
for(const L of cityX.concat(cityZ))if(L.cross.length<2){L.a=-WORLD+10;L.b=WORLD-10;}
computeCross();
const inters=[];
for(const L of cityX)for(const W of L.cross)inters.push({x:L.c,z:W.c});
const spawnX=cityX[midX].c, spawnZ=cityZ[midZ].c;

// ---------- renderer / scene ----------
const scene=new THREE.Scene();
const camera=new THREE.PerspectiveCamera(70,innerWidth/innerHeight,.1,1400);
const renderer=new THREE.WebGLRenderer({antialias:true});
renderer.setSize(innerWidth,innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.outputEncoding=THREE.sRGBEncoding;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.05;
document.getElementById('c').appendChild(renderer.domElement);
// procedural PBR environment map → soft realistic reflections on cars, glass and water
{
  const ec=document.createElement('canvas');ec.width=256;ec.height=128;const eg=ec.getContext('2d');
  const grd=eg.createLinearGradient(0,0,0,128);
  grd.addColorStop(0,'#8fb8e6');grd.addColorStop(.48,'#d2e2f2');grd.addColorStop(.52,'#8a8378');grd.addColorStop(1,'#40413e');
  eg.fillStyle=grd;eg.fillRect(0,0,256,128);
  const et=new THREE.CanvasTexture(ec);et.mapping=THREE.EquirectangularReflectionMapping;
  const pmrem=new THREE.PMREMGenerator(renderer);pmrem.compileEquirectangularShader();
  scene.environment=pmrem.fromEquirectangular(et).texture;et.dispose();pmrem.dispose();
}
// asset pipeline: upgrade the procedural env to a real CC0 HDRI when it finishes loading
const assets=new AssetManager(renderer);
let assetsReady=false;
function markReady(){
  if(assetsReady)return;assetsReady=true;
  const p=document.querySelector('#intro p');if(p)p.textContent='CLICK OR PRESS ANY KEY TO START';
}
{const p=document.querySelector('#intro p');if(p)p.textContent='LOADING WORLD…';}
let booted=false;
function runBoot(){if(booted)return;booted=true;boot();markReady();}   // spawn vehicles once GLB models are in
const CARGLBS=['sedan','sedan-sports','hatchback-sports','suv','suv-luxury','taxi','van','race','police'];
Promise.all([
  assets.loadHDRI('./assets/hdri/sky_1k.hdr').then(env=>{scene.environment=env;}).catch(()=>{}),
  ...CARGLBS.map(id=>assets.loadGLTF(id,`./assets/models/cars/${id}.glb`).catch(()=>{}))
]).then(runBoot);
setTimeout(runBoot,10000);     // never hard-block if the CDN/assets are slow or offline
scene.fog=new THREE.Fog(0x87ceeb,120,900);
// ---------- post-processing: bloom + cinematic colour grade (degrades gracefully if CDN modules miss) ----------
let composer=null,bloomPass=null;
if(EffectComposer&&UnrealBloomPass&&RenderPass&&ShaderPass)try{
  composer=new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene,camera));
  bloomPass=new UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight),.55,.6,.82); // strength, radius, threshold
  composer.addPass(bloomPass);
  const GradeShader={
    uniforms:{tDiffuse:{value:null},sat:{value:.93},con:{value:1.09},vig:{value:.42}},
    vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader:'varying vec2 vUv;uniform sampler2D tDiffuse;uniform float sat,con,vig;'
      +'void main(){vec3 c=texture2D(tDiffuse,vUv).rgb;'
      +'c=(c-0.5)*con+0.5;'                                   // contrast
      +'float l=dot(c,vec3(0.299,0.587,0.114));c=mix(vec3(l),c,sat);' // desaturate slightly
      +'c*=vec3(1.03,1.0,0.97);'                              // gentle warm grade
      +'float d=distance(vUv,vec2(0.5));c*=mix(1.0,0.6,clamp((d-0.25)*vig*2.2,0.0,1.0));' // vignette
      +'c=pow(clamp(c,0.0,1.0),vec3(1.0/2.2));'               // linear -> sRGB (composer target is linear)
      +'gl_FragColor=vec4(c,1.0);}'
  };
  composer.addPass(new ShaderPass(GradeShader));
  composer.setSize(innerWidth,innerHeight);
}catch(e){composer=null;}
function renderFrame(){composer?composer.render():renderer.render(scene,camera);}
const hemi=new THREE.HemisphereLight(0xbfd6ff,0x4a4034,.6);scene.add(hemi);
const sun=new THREE.DirectionalLight(0xfff2dd,1.1);
sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);
sun.shadow.radius=4;sun.shadow.bias=-0.0004;sun.shadow.normalBias=.6;   // soft, artifact-free contact shadows
const sc=sun.shadow.camera;sc.left=-150;sc.right=150;sc.top=150;sc.bottom=-150;sc.near=20;sc.far=600;
scene.add(sun);scene.add(sun.target);
// night sky stars
const starGeo=new THREE.BufferGeometry();
{const a=new Float32Array(1200);
for(let i=0;i<400;i++){const th=Math.random()*Math.PI*2,ph=Math.random()*1.2;
  a[i*3]=Math.sin(th)*Math.cos(ph)*800;a[i*3+1]=Math.sin(ph)*800+30;a[i*3+2]=Math.cos(th)*Math.cos(ph)*800;}
starGeo.setAttribute('position',new THREE.BufferAttribute(a,3));}
const stars=new THREE.Points(starGeo,new THREE.PointsMaterial({color:0xcfe0ff,size:1.8,transparent:true,opacity:0,sizeAttenuation:false}));
scene.add(stars);
// player headlight beams (lit at night)
const hlights=[0,1].map(()=>{
  const s=new THREE.SpotLight(0xfff3d0,0,60,.55,.5,1.3);
  scene.add(s);scene.add(s.target);return s;
});
// ---------- gradient sky dome with sun disk (bloom turns it into a soft glow) ----------
let sky=null;
try{
  const skyMat=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,depthTest:false,fog:false,
    uniforms:{top:{value:new THREE.Color(0x2f6fb0)},bot:{value:new THREE.Color(0x87ceeb)},
              sunDir:{value:new THREE.Vector3(0,1,0)},sunCol:{value:new THREE.Color(1,.9,.7)}},
    vertexShader:'varying vec3 vp;void main(){vp=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader:'varying vec3 vp;uniform vec3 top,bot,sunDir,sunCol;'
      +'void main(){float h=clamp(vp.y*0.5+0.5,0.0,1.0);vec3 c=mix(bot,top,pow(h,0.65));'
      +'float s=max(dot(vp,normalize(sunDir)),0.0);'
      +'c+=sunCol*pow(s,250.0)*1.6;'      // crisp sun disk
      +'c+=sunCol*pow(s,7.0)*0.16;'       // warm glow around it
      +'gl_FragColor=vec4(c,1.0);}'});
  sky=new THREE.Mesh(new THREE.SphereGeometry(1000,32,16),skyMat);
  sky.frustumCulled=false;sky.renderOrder=-1;scene.add(sky);
}catch(e){sky=null;}

// ---------- ground painted onto one texture ----------
const blocks=[];
for(let i=0;i<cityX.length-1;i++)for(let j=0;j<cityZ.length-1;j++){
  const x0=cityX[i].c+HALF,x1=cityX[i+1].c-HALF,z0=cityZ[j].c+HALF,z1=cityZ[j+1].c-HALF;
  if(x1-x0<14||z1-z0<14)continue;
  const cx=(x0+x1)/2,cz=(z0+z1)/2,d=Math.hypot(cx-spawnX,cz-spawnZ);
  blocks.push({x0,x1,z0,z1,cx,cz,d,park:d>110&&Math.random()<.13,paved:d<300});
}
// ---------- river: a water channel down the widest block-column gap, crossed by bridges ----------
let river=null;
{
  let riverIdx=-1,bestGap=0;
  for(let i=0;i<cityX.length-1;i++){
    const g=cityX[i+1].c-cityX[i].c, mid=(cityX[i].c+cityX[i+1].c)/2;
    if(Math.abs(mid-spawnX)<70)continue;          // keep the river clear of spawn
    if(g>bestGap){bestGap=g;riverIdx=i;}
  }
  if(riverIdx>=0&&bestGap>46){
    const rcx=(cityX[riverIdx].c+cityX[riverIdx+1].c)/2, rHalf=Math.min(16,bestGap/2-HALF-3);
    river={cx:rcx,x0:rcx-rHalf,x1:rcx+rHalf,half:rHalf};
    for(const b of blocks)if(b.cx>river.x0-2&&b.cx<river.x1+2)b.river=true;
    river.cross=cityZ.filter(W=>W.a<river.x0-2&&W.b>river.x1+2).map(W=>W.c); // horizontal roads that bridge it
  }
}
function paintCity(ctx,S,mini){
  const s=S/(WORLD*2), X=x=>(x+WORLD)*s, Z=z=>(z+WORLD)*s;
  ctx.fillStyle=mini?'#161c26':'#4a7c3a';ctx.fillRect(0,0,S,S);
  if(!mini)for(let i=0;i<2500;i++){ctx.fillStyle=Math.random()<.5?'rgba(0,0,0,.06)':'rgba(255,255,210,.05)';
    ctx.fillRect(Math.random()*S,Math.random()*S,rnd(2,7),rnd(2,7));}
  for(const b of blocks){
    ctx.fillStyle=b.park?(mini?'#1f3d28':'#3b6e2f'):(b.paved?(mini?'#262e3c':'#9aa0a6'):(mini?'#1d2531':'#557a42'));
    ctx.fillRect(X(b.x0-SIDE),Z(b.z0-SIDE),(b.x1-b.x0+2*SIDE)*s,(b.z1-b.z0+2*SIDE)*s);
  }
  for(const L of cityX){ctx.fillStyle=mini?'#39455c':'#8e9196';ctx.fillRect(X(L.c-HALF),Z(L.a-HALF),2*HALF*s,(L.b-L.a+2*HALF)*s);}
  for(const W of cityZ){ctx.fillStyle=mini?'#39455c':'#8e9196';ctx.fillRect(X(W.a-HALF),Z(W.c-HALF),(W.b-W.a+2*HALF)*s,2*HALF*s);}
  if(!mini){ // sidewalk expansion-joint lines
    ctx.fillStyle='rgba(0,0,0,.07)';
    for(const L of cityX)for(let z=L.a;z<L.b;z+=4)ctx.fillRect(X(L.c-HALF),Z(z),2*HALF*s,1);
    for(const W of cityZ)for(let x=W.a;x<W.b;x+=4)ctx.fillRect(X(x),Z(W.c-HALF),1,2*HALF*s);
  }
  for(const L of cityX){ctx.fillStyle=mini?'#aeb9cc':'#33373d';ctx.fillRect(X(L.c-ROAD_W/2),Z(L.a-ROAD_W/2),ROAD_W*s,(L.b-L.a+ROAD_W)*s);}
  for(const W of cityZ){ctx.fillStyle=mini?'#aeb9cc':'#33373d';ctx.fillRect(X(W.a-ROAD_W/2),Z(W.c-ROAD_W/2),(W.b-W.a+ROAD_W)*s,ROAD_W*s);}
  if(river){ // water covers everything in its band (roads included → bridges are 3D meshes on top)
    ctx.fillStyle=mini?'#16384f':'#2b6a8a';ctx.fillRect(X(river.x0),0,(river.x1-river.x0)*s,S);
    if(!mini){ctx.fillStyle='#4a3a28';ctx.fillRect(X(river.x0)-2,0,2,S);ctx.fillRect(X(river.x1),0,2,S);}
  }
  if(mini)return;
  ctx.fillStyle='#d9a514';
  for(const L of cityX)for(let z=L.a;z<L.b;z+=8)ctx.fillRect(X(L.c)-Math.max(1,.25*s),Z(z),Math.max(2,.5*s),3.5*s);
  for(const W of cityZ)for(let x=W.a;x<W.b;x+=8)ctx.fillRect(X(x),Z(W.c)-Math.max(1,.25*s),3.5*s,Math.max(2,.5*s));
  ctx.fillStyle='rgba(255,255,255,.85)';
  for(const it of inters)for(let k=-2;k<=2;k++){
    ctx.fillRect(X(it.x+k*2.4)-Math.max(1,.7*s),Z(it.z-ROAD_W/2-2.2),Math.max(2,1.4*s),2*s);
    ctx.fillRect(X(it.x+k*2.4)-Math.max(1,.7*s),Z(it.z+ROAD_W/2+.2),Math.max(2,1.4*s),2*s);
    ctx.fillRect(X(it.x-ROAD_W/2-2.2),Z(it.z+k*2.4)-Math.max(1,.7*s),2*s,Math.max(2,1.4*s));
    ctx.fillRect(X(it.x+ROAD_W/2+.2),Z(it.z+k*2.4)-Math.max(1,.7*s),2*s,Math.max(2,1.4*s));
  }
}
const groundCv=document.createElement('canvas');groundCv.width=groundCv.height=2048;
paintCity(groundCv.getContext('2d'),2048,false);
const groundTex=new THREE.CanvasTexture(groundCv);
groundTex.encoding=THREE.sRGBEncoding;groundTex.anisotropy=renderer.capabilities.getMaxAnisotropy();
const ground=new THREE.Mesh(new THREE.PlaneGeometry(WORLD*2,WORLD*2),
  new THREE.MeshStandardMaterial({map:groundTex,roughness:.88,metalness:.04,envMapIntensity:.25}));
ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;scene.add(ground);
const mapCv=document.createElement('canvas');mapCv.width=mapCv.height=720;
paintCity(mapCv.getContext('2d'),720,true);

// ---------- building materials ----------
function buildingMat(base,glass,rows){
  const c=document.createElement('canvas'),e=document.createElement('canvas');
  c.width=e.width=128;c.height=e.height=256;
  const g=c.getContext('2d'),ge=e.getContext('2d');
  g.fillStyle=base;g.fillRect(0,0,128,256);
  ge.fillStyle='#000';ge.fillRect(0,0,128,256);
  const rh=256/rows;
  for(let r=0;r<rows;r++)for(let x=7;x<118;x+=15){
    const y=r*rh+rh*.22;
    g.fillStyle=glass;g.fillRect(x,y,10,rh*.5);
    if(Math.random()<.4){ge.fillStyle=pick(['#ffd27a','#fff3cf','#bcd9ff']);ge.fillRect(x,y,10,rh*.5);}
  }
  g.fillStyle='rgba(0,0,0,.25)';for(let r=0;r<=rows;r++)g.fillRect(0,r*rh-1,128,2);
  const map=new THREE.CanvasTexture(c);map.encoding=THREE.sRGBEncoding;
  return new THREE.MeshStandardMaterial({map,emissive:0xffffff,emissiveMap:new THREE.CanvasTexture(e),emissiveIntensity:0,roughness:.74,metalness:.08,envMapIntensity:.55});
}
const towerMats=['#3a4f66','#52667a','#2d3a46','#485460','#5d6d7e','#37475a'].map(c=>buildingMat(c,'#a8c8e0',16));
const lowMats=['#9c6b4f','#a98467','#7d6b5d','#b0917a','#8a7f8d','#6e7f80'].map(c=>buildingMat(c,'#e8e0c0',5));
const bldMats=towerMats.concat(lowMats);
const roofMat=new THREE.MeshStandardMaterial({color:0x2c2f33,roughness:.85,metalness:.15,envMapIntensity:.4});

// ---------- buildings, parks, trees ----------
const colliders=[];
const treeGeoT=new THREE.CylinderGeometry(.35,.5,3.4,6);
const treeGeoL=new THREE.SphereGeometry(2.4,7,6);
const treeMatT=new THREE.MeshStandardMaterial({color:0x6b4a2e,roughness:.92,metalness:0});
const treeMatL=new THREE.MeshStandardMaterial({color:0x2f6b2a,roughness:.9,metalness:0,envMapIntensity:.3});
function addTree(x,z){
  const t=new THREE.Mesh(treeGeoT,treeMatT);t.position.set(x,1.7,z);t.castShadow=true;scene.add(t);
  const base=rnd(.85,1.25);
  for(let k=0;k<2;k++){ // stacked canopy puffs → fuller, less lollipop
    const l=new THREE.Mesh(treeGeoL,treeMatL);
    l.position.set(x+rnd(-.4,.4),4.1+k*1.2,z+rnd(-.4,.4));
    l.scale.setScalar(base*(1-k*.22));l.castShadow=true;scene.add(l);
  }
}
// ---------- enterable landmarks (hospital / police / food court) ----------
const landmarks=[];
function signTexture(text,bg,fg){
  const c=document.createElement('canvas');c.width=256;c.height=64;const g=c.getContext('2d');
  g.fillStyle=bg;g.fillRect(0,0,256,64);g.fillStyle=fg;g.font='bold 30px Arial';
  g.textAlign='center';g.textBaseline='middle';g.fillText(text,128,34);
  const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;return t;
}
function buildLandmarkProps(type,cx,cz,hw,hd){
  if(type==='hospital'){
    const bedMat=new THREE.MeshPhongMaterial({color:0xffffff}),pil=new THREE.MeshPhongMaterial({color:0x9fd3ff});
    for(let i=0;i<3;i++){const bx=cx-hw+4+i*4.4,bz=cz+hd-4;
      const bed=new THREE.Mesh(new THREE.BoxGeometry(1.3,.5,2.4),bedMat);bed.position.set(bx,.45,bz);bed.castShadow=true;scene.add(bed);
      const pw=new THREE.Mesh(new THREE.BoxGeometry(1.1,.2,.5),pil);pw.position.set(bx,.72,bz-.9);scene.add(pw);}
    const crMat=new THREE.MeshPhongMaterial({color:0xd63031,emissive:0xd63031,emissiveIntensity:.45});
    const c1=new THREE.Mesh(new THREE.BoxGeometry(1.4,.34,.2),crMat);c1.position.set(cx,2.9,cz);scene.add(c1);
    const c2=new THREE.Mesh(new THREE.BoxGeometry(.34,1.4,.2),crMat);c2.position.set(cx,2.9,cz);scene.add(c2);
    const desk=new THREE.Mesh(new THREE.BoxGeometry(3,1,1),new THREE.MeshPhongMaterial({color:0xccd6dd}));desk.position.set(cx,.5,cz-hd+3);scene.add(desk);
  }else if(type==='police'){
    const dk=new THREE.MeshPhongMaterial({color:0x2c3e50});
    for(let i=0;i<2;i++){const d=new THREE.Mesh(new THREE.BoxGeometry(2.4,1,1.1),dk);d.position.set(cx-3+i*6,.5,cz);d.castShadow=true;scene.add(d);}
    const co=new THREE.MeshPhongMaterial({color:0xe67e22});
    for(let i=0;i<4;i++){const c=new THREE.Mesh(new THREE.ConeGeometry(.3,.8,8),co);c.position.set(cx-3+i*2,.4,cz+hd-2.5);scene.add(c);}
    const bd=new THREE.Mesh(new THREE.BoxGeometry(3,1.6,.2),new THREE.MeshPhongMaterial({color:0x16306e}));bd.position.set(cx,1.6,cz-hd+1);scene.add(bd);
  }else{
    const umb=[0xe74c3c,0x27ae60,0x2980b9,0xf1c40f];
    for(let i=0;i<4;i++){const tx=cx-hw+5+(i%2)*6,tz=cz-hd+5+Math.floor(i/2)*6;
      const top=new THREE.Mesh(new THREE.CylinderGeometry(.9,.9,.14,16),new THREE.MeshPhongMaterial({color:0xddd0b0}));top.position.set(tx,.92,tz);top.castShadow=true;scene.add(top);
      const leg=new THREE.Mesh(new THREE.CylinderGeometry(.12,.12,.9),new THREE.MeshPhongMaterial({color:0x555555}));leg.position.set(tx,.45,tz);scene.add(leg);
      const pole=new THREE.Mesh(new THREE.CylinderGeometry(.05,.05,1.6),new THREE.MeshPhongMaterial({color:0x888888}));pole.position.set(tx,1.6,tz);scene.add(pole);
      const um=new THREE.Mesh(new THREE.ConeGeometry(1.7,1,10),new THREE.MeshPhongMaterial({color:umb[i]}));um.position.set(tx,2.45,tz);scene.add(um);}
    const booth=new THREE.Mesh(new THREE.BoxGeometry(2*hw-4,2,2),new THREE.MeshPhongMaterial({color:0xc0392b}));booth.position.set(cx,1,cz+hd-2);booth.castShadow=true;scene.add(booth);
  }
}
function buildLandmark(b,cfg){
  const cx=b.cx,cz=b.cz;
  const hw=Math.min((b.x1-b.x0)/2-1,20),hd=Math.min((b.z1-b.z0)/2-1,20);
  const wallH=5,GAP=7,TH=.6;
  const wallMat=new THREE.MeshPhongMaterial({color:cfg.wall,shininess:8});
  const fl=new THREE.Mesh(new THREE.BoxGeometry(2*hw,.2,2*hd),new THREE.MeshPhongMaterial({color:cfg.floor,shininess:6}));
  fl.position.set(cx,.11,cz);fl.receiveShadow=true;scene.add(fl);
  const toSx=spawnX-cx,toSz=spawnZ-cz,horiz=Math.abs(toSx)>Math.abs(toSz);
  const entAxis=horiz?'z':'x',entSign=horiz?Math.sign(toSx||1):Math.sign(toSz||1);
  function wall(x,z,w,d){const m=new THREE.Mesh(new THREE.BoxGeometry(w,wallH,d),wallMat);m.position.set(x,wallH/2,z);m.castShadow=true;m.receiveShadow=true;scene.add(m);colliders.push({x0:x-w/2,x1:x+w/2,z0:z-d/2,z1:z+d/2});}
  function side(axis,sign){
    const ent=(axis===entAxis&&sign===entSign);
    if(axis==='x'){const z=cz+sign*hd;
      if(!ent)wall(cx,z,2*hw+TH,TH);
      else{const sw=(2*hw-GAP)/2;wall(cx-(GAP/2+sw/2),z,sw,TH);wall(cx+(GAP/2+sw/2),z,sw,TH);}
    }else{const x=cx+sign*hw;
      if(!ent)wall(x,cz,TH,2*hd+TH);
      else{const sd=(2*hd-GAP)/2;wall(x,cz-(GAP/2+sd/2),TH,sd);wall(x,cz+(GAP/2+sd/2),TH,sd);}}
  }
  side('x',1);side('x',-1);side('z',1);side('z',-1);
  const sg=new THREE.Group();
  sg.add(new THREE.Mesh(new THREE.BoxGeometry(8.2,2.2,.3),new THREE.MeshPhongMaterial({color:0x111417})));
  const sgn=new THREE.Mesh(new THREE.PlaneGeometry(8,2),new THREE.MeshBasicMaterial({map:signTexture(cfg.sign,cfg.bg,cfg.fg),transparent:true}));
  sgn.position.z=.18;sg.add(sgn);
  if(entAxis==='z'){sg.position.set(cx+entSign*(hw+.25),wallH+.5,cz);sg.rotation.y=entSign>0?Math.PI/2:-Math.PI/2;}
  else{sg.position.set(cx,wallH+.5,cz+entSign*(hd+.25));sg.rotation.y=entSign>0?0:Math.PI;}
  scene.add(sg);
  const lt=new THREE.PointLight(cfg.light,.7,Math.max(hw,hd)*2.6,2);lt.position.set(cx,wallH-1,cz);scene.add(lt);
  // flat roof — auto-hidden while the player is inside so the camera can see in
  const roof=new THREE.Mesh(new THREE.BoxGeometry(2*hw+TH+.4,.4,2*hd+TH+.4),new THREE.MeshPhongMaterial({color:0x676d77,shininess:6}));
  roof.position.set(cx,wallH+.25,cz);roof.castShadow=true;roof.receiveShadow=true;scene.add(roof);
  // small parapet trim
  const para=new THREE.Mesh(new THREE.BoxGeometry(2*hw+TH+.6,.5,2*hd+TH+.6),new THREE.MeshPhongMaterial({color:cfg.wall}));
  para.position.set(cx,wallH+.5,cz);scene.add(para);roof.userData.para=para;
  buildLandmarkProps(cfg.type,cx,cz,hw,hd);
  landmarks.push({type:cfg.type,name:cfg.name,x:cx,z:cz,hw,hd,roof,r:Math.min(hw,hd)-1,
    color:cfg.type==='hospital'?'#e74c3c':cfg.type==='police'?'#2e6fff':'#e67e22'});
}
{
  const LM=[{type:'hospital',name:'HOSPITAL',sign:'+ HOSPITAL',bg:'#ffffff',fg:'#d63031',floor:0xdfe6e9,wall:0xeef2f4,light:0xffeaea},
            {type:'police',name:'POLICE STATION',sign:'POLICE',bg:'#16306e',fg:'#ffffff',floor:0x3a4658,wall:0x5b6b80,light:0xdfe7ff},
            {type:'food',name:'FOOD COURT',sign:'FOOD COURT',bg:'#e67e22',fg:'#ffffff',floor:0xe8d8b0,wall:0xb98a5a,light:0xfff1da}];
  const cand=blocks.filter(b=>!b.park&&!b.river&&(b.x1-b.x0)>30&&(b.z1-b.z0)>30).sort((a,b)=>a.d-b.d);
  const chosen=[];
  for(let i=0;i<cand.length&&chosen.length<3;i++){const b=cand[i];
    if(chosen.every(c=>Math.hypot(c.cx-b.cx,c.cz-b.cz)>95))chosen.push(b);}
  for(let i=0;i<cand.length&&chosen.length<3;i++)if(!chosen.includes(cand[i]))chosen.push(cand[i]);
  chosen.forEach((b,i)=>{b.special=true;buildLandmark(b,LM[i]);});
}

for(const b of blocks){
  if(b.special||b.river)continue;
  if(b.park){for(let t=0;t<10;t++)addTree(rnd(b.x0+3,b.x1-3),rnd(b.z0+3,b.z1-3));continue;}
  const bw=b.x1-b.x0,bd=b.z1-b.z0;
  const nx=Math.max(1,Math.round(bw/36)),nz=Math.max(1,Math.round(bd/36));
  for(let i=0;i<nx;i++)for(let j=0;j<nz;j++){
    if(Math.random()<.08){addTree(b.x0+(i+.5)*bw/nx,b.z0+(j+.5)*bd/nz);continue;}
    const cw=bw/nx,cd=bd/nz;
    const w=cw-rnd(5,9),d=cd-rnd(5,9);
    if(w<8||d<8)continue;
    const cx=b.x0+(i+.5)*cw,cz=b.z0+(j+.5)*cd;
    let h,mat;
    if(b.d<140){h=rnd(40,95);mat=pick(towerMats);}
    else if(b.d<280){h=rnd(16,42);mat=pick(towerMats);}
    else{h=rnd(7,15);mat=pick(lowMats);}
    const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),[mat,mat,roofMat,mat,mat,mat]);
    m.position.set(cx,h/2,cz);m.castShadow=true;m.receiveShadow=true;scene.add(m);
    colliders.push({x0:cx-w/2,x1:cx+w/2,z0:cz-d/2,z1:cz+d/2});
    if(h>50&&Math.random()<.6){
      const a=new THREE.Mesh(new THREE.CylinderGeometry(.15,.15,rnd(5,12)),roofMat);
      a.position.set(cx,h+4,cz);scene.add(a);
    }else if(Math.random()<.4){
      const r=new THREE.Mesh(new THREE.BoxGeometry(w*.45,3,d*.45),roofMat);
      r.position.set(cx,h+1.5,cz);scene.add(r);
    }
  }
}

// ---------- terrain: outer landscape, river water + bridges, mountains, forest belt ----------
{
  // green land extending past the city out to the mountains
  const outer=new THREE.Mesh(new THREE.PlaneGeometry(1900,1900),new THREE.MeshPhongMaterial({color:0x3f5e34,shininess:2}));
  outer.rotation.x=-Math.PI/2;outer.position.y=-1.4;outer.receiveShadow=true;scene.add(outer);
}
if(river){
  // animated-looking water sheet sitting just above the painted channel
  const waterMat=new THREE.MeshStandardMaterial({color:0x21617f,roughness:.08,metalness:.65,envMapIntensity:1.3,transparent:true,opacity:.86});
  const water=new THREE.Mesh(new THREE.PlaneGeometry(river.x1-river.x0,WORLD*2,1,48),waterMat);
  water.rotation.x=-Math.PI/2;water.position.set(river.cx,.05,0);water.receiveShadow=true;scene.add(water);
  river.water=water;
  // retaining banks become solid colliders, broken only where bridges cross
  const bankMat=new THREE.MeshPhongMaterial({color:0x6b5a44,shininess:8});
  const gaps=river.cross.map(c=>[c-(ROAD_W/2+2.5),c+(ROAD_W/2+2.5)]).sort((a,b)=>a[0]-b[0]);
  for(const bx of [river.x0,river.x1]){
    let z=-WORLD;
    const seg=(z0,z1)=>{if(z1-z0<1.5)return;
      const w=new THREE.Mesh(new THREE.BoxGeometry(1.2,1.1,z1-z0),bankMat);
      w.position.set(bx,.35,(z0+z1)/2);w.castShadow=w.receiveShadow=true;scene.add(w);
      colliders.push({x0:bx-.6,x1:bx+.6,z0,z1});};
    for(const [g0,g1] of gaps){seg(z,g0);z=g1;}
    seg(z,WORLD);
  }
  // bridge decks + railings carry the crossing roads over the water (flush with road level)
  const deckMat=new THREE.MeshPhongMaterial({color:0x55585e,shininess:18});
  const railMat=new THREE.MeshPhongMaterial({color:0xb6bac0,shininess:40});
  const span=(river.x1-river.x0)+6, deckD=ROAD_W+5;
  for(const cz of river.cross){
    const deck=new THREE.Mesh(new THREE.BoxGeometry(span,.4,deckD),deckMat);
    deck.position.set(river.cx,-.1,cz);deck.castShadow=deck.receiveShadow=true;scene.add(deck);
    for(const sz of [cz-(deckD/2-.2),cz+(deckD/2-.2)]){
      const rail=new THREE.Mesh(new THREE.BoxGeometry(span,.6,.22),railMat);
      rail.position.set(river.cx,.42,sz);rail.castShadow=true;scene.add(rail);
    }
  }
}
{
  // distant mountain ring (decorative, beyond the playable area → no colliders)
  const rockMat=new THREE.MeshPhongMaterial({color:0x5b5248,flatShading:true,shininess:2});
  const snowMat=new THREE.MeshPhongMaterial({color:0xeef2f6,flatShading:true,shininess:5});
  const N=30;
  for(let i=0;i<N;i++){
    const a=(i/N)*Math.PI*2+rnd(-.06,.06), rad=rnd(540,660), h=rnd(70,185), br=rnd(60,130);
    const x=Math.cos(a)*rad, z=Math.sin(a)*rad;
    const m=new THREE.Mesh(new THREE.ConeGeometry(br,h,4+(Math.random()*4|0),1),rockMat);
    m.position.set(x,h/2-6,z);m.rotation.y=rnd(0,7);scene.add(m);
    if(h>120){const capH=h*.3;const cap=new THREE.Mesh(new THREE.ConeGeometry(br*.34,capH,6),snowMat);
      cap.position.set(x,(h-6)-capH*.4,z);scene.add(cap);}
  }
}
{
  // instanced forest belt in the outskirts (one draw call per part → stays scalable)
  const FN=220;
  const trunkI=new THREE.InstancedMesh(treeGeoT,treeMatT,FN), leafI=new THREE.InstancedMesh(treeGeoL,treeMatL,FN);
  trunkI.castShadow=leafI.castShadow=true;scene.add(trunkI,leafI);
  const _m=new THREE.Matrix4(),_p=new THREE.Vector3(),_q=new THREE.Quaternion(),_s=new THREE.Vector3();
  for(let i=0;i<FN;i++){
    const a=rnd(0,Math.PI*2), rad=rnd(WORLD-18,515), x=Math.cos(a)*rad, z=Math.sin(a)*rad, sc=rnd(.8,1.55);
    _q.setFromAxisAngle(new THREE.Vector3(0,1,0),rnd(0,7));
    _p.set(x,1.7*sc,z);_s.set(sc,sc,sc);_m.compose(_p,_q,_s);trunkI.setMatrixAt(i,_m);
    _p.set(x,4.3*sc,z);_s.setScalar(sc*1.15);_m.compose(_p,_q,_s);leafI.setMatrixAt(i,_m);
  }
  trunkI.instanceMatrix.needsUpdate=leafI.instanceMatrix.needsUpdate=true;
}

// ---------- traffic lights ----------
const tlights=[];
const poleMat=new THREE.MeshPhongMaterial({color:0x1c1c1c});
const bulbGeo=new THREE.SphereGeometry(.26,8,8);
let placed=0;
for(const it of inters){
  if(placed>=24||Math.hypot(it.x-spawnX,it.z-spawnZ)>240)continue;placed++;
  const g=new THREE.Group();
  const pole=new THREE.Mesh(new THREE.CylinderGeometry(.18,.18,7.6),poleMat);pole.position.y=3.8;g.add(pole);
  const head=new THREE.Mesh(new THREE.BoxGeometry(.9,2.4,.9),poleMat);head.position.y=7.6;g.add(head);
  const mk=c=>new THREE.Mesh(bulbGeo,new THREE.MeshBasicMaterial({color:c}));
  const R=mk(0x440000),Y=mk(0x444400),G=mk(0x004400);
  R.position.set(0,8.3,.5);Y.position.set(0,7.6,.5);G.position.set(0,6.9,.5);
  g.add(R,Y,G);g.position.set(it.x+HALF+1.2,0,it.z+HALF+1.2);scene.add(g);
  tlights.push({R,Y,G});
}
// street lamps (glow at night)
const lampHead=new THREE.MeshPhongMaterial({color:0xfff2cc,emissive:0xffd9a0,emissiveIntensity:0});
{let n=0;
for(const it of inters){
  if(n>=40||Math.hypot(it.x-spawnX,it.z-spawnZ)>320)continue;n++;
  const p=new THREE.Mesh(new THREE.CylinderGeometry(.12,.16,6.5),poleMat);
  p.position.set(it.x-HALF-1,3.25,it.z-HALF-1);scene.add(p);
  const h=new THREE.Mesh(new THREE.SphereGeometry(.35,8,6),lampHead);
  h.position.set(it.x-HALF-1,6.6,it.z-HALF-1);scene.add(h);
}}
let lightT=rnd(0,17);
function lightState(axis){
  const t=lightT%17;
  if(axis==='z')return t<7?'G':t<8.5?'Y':'R';
  return t<8.5?'R':t<15.5?'G':'Y';
}

// ---------- street props (instanced) + market stalls + cows ----------
function propMesh(geo,mat,count){const m=new THREE.InstancedMesh(geo,mat,count);m.castShadow=true;m.instanceMatrix.setUsage(THREE.StaticDrawUsage);scene.add(m);return m;}
{
  const binGeo=new THREE.CylinderGeometry(.3,.26,.8,8),hydGeo=new THREE.CylinderGeometry(.18,.2,.7,8),benchGeo=new THREE.BoxGeometry(1.7,.18,.5);
  const PMAX=140;
  const iBin=propMesh(binGeo,new THREE.MeshPhongMaterial({color:0x2f6f3f}),PMAX);
  const iHyd=propMesh(hydGeo,new THREE.MeshPhongMaterial({color:0xc0392b}),PMAX);
  const iBench=propMesh(benchGeo,new THREE.MeshPhongMaterial({color:0x6b4a2e}),PMAX);
  const _m=new THREE.Matrix4(),_p=new THREE.Vector3(),_q=new THREE.Quaternion(),_s=new THREE.Vector3(1,1,1),_z=new THREE.Matrix4().makeScale(0,0,0);
  let nb=0,nh=0,ne=0;
  const place=(x,z,alongZ)=>{const r=Math.random();_p.set(x,0,z);
    if(r<.4&&nb<PMAX){_p.y=.4;_m.compose(_p,_q,_s);iBin.setMatrixAt(nb++,_m);}
    else if(r<.7&&nh<PMAX){_p.y=.35;_m.compose(_p,_q,_s);iHyd.setMatrixAt(nh++,_m);}
    else if(ne<PMAX){_p.y=.5;_q.setFromAxisAngle(new THREE.Vector3(0,1,0),alongZ?0:Math.PI/2);_m.compose(_p,_q,_s);iBench.setMatrixAt(ne++,_m);_q.identity();}};
  for(const L of cityX)for(let z=L.a+12;z<L.b-12;z+=rnd(20,38))place(L.c+(Math.random()<.5?1:-1)*(HALF-1.2),z,true);
  for(const W of cityZ)for(let x=W.a+12;x<W.b-12;x+=rnd(20,38))if(!(river&&x>river.x0&&x<river.x1))place(x,W.c+(Math.random()<.5?1:-1)*(HALF-1.2),false);
  for(let i=nb;i<PMAX;i++)iBin.setMatrixAt(i,_z);
  for(let i=nh;i<PMAX;i++)iHyd.setMatrixAt(i,_z);
  for(let i=ne;i<PMAX;i++)iBench.setMatrixAt(i,_z);
  iBin.instanceMatrix.needsUpdate=iHyd.instanceMatrix.needsUpdate=iBench.instanceMatrix.needsUpdate=true;
  // colourful roadside market stalls
  const canopy=[0xe74c3c,0x27ae60,0x2980b9,0xf1c40f,0xe67e22,0x9b59b6];
  for(let i=0;i<12;i++){const L=pick(cityX),z=rnd(L.a+15,L.b-15),side=Math.random()<.5?1:-1,x=L.c+side*(HALF+1.6);
    const st=new THREE.Group();
    const base=new THREE.Mesh(new THREE.BoxGeometry(2.2,1,1.4),new THREE.MeshPhongMaterial({color:0x8a5a2b}));base.position.y=.5;base.castShadow=true;
    const can=new THREE.Mesh(new THREE.BoxGeometry(2.6,.2,1.8),new THREE.MeshPhongMaterial({color:pick(canopy)}));can.position.y=1.5;
    st.add(base,can);st.position.set(x,0,z);scene.add(st);}
}
function makeCow(){
  const g=new THREE.Group();const hide=new THREE.MeshStandardMaterial({color:0xe8e0d0,roughness:.85,metalness:0,envMapIntensity:.2}),dark=new THREE.MeshStandardMaterial({color:0x4a3526,roughness:.85,metalness:0});
  const body=new THREE.Mesh(new THREE.BoxGeometry(1.0,1.0,2.0),hide);body.position.y=1.1;body.castShadow=true;g.add(body);
  const head=new THREE.Mesh(new THREE.BoxGeometry(.6,.6,.7),hide);head.position.set(0,1.2,1.3);g.add(head);
  for(const[lx,lz]of[[-.35,.7],[.35,.7],[-.35,-.7],[.35,-.7]]){const leg=new THREE.Mesh(new THREE.BoxGeometry(.22,1.1,.22),dark);leg.position.set(lx,.55,lz);g.add(leg);}
  scene.add(g);return g;
}
const cows=[];
for(let i=0;i<4;i++){const c=makeCow(),W=pick(cityZ);c.position.set(rnd(-WORLD+40,WORLD-40),0,W.c+(Math.random()<.5?1:-1)*(HALF-2));cows.push({mesh:c,ang:rnd(0,7)});}
function cowUpdate(c,dtF){const m=c.mesh;if(Math.random()<.012)c.ang+=rnd(-1,1);
  m.position.x=M.clamp(m.position.x+Math.sin(c.ang)*.02*dtF,-WORLD+5,WORLD-5);
  m.position.z=M.clamp(m.position.z+Math.cos(c.ang)*.02*dtF,-WORLD+5,WORLD-5);m.rotation.y=c.ang;}

// ---------- vehicle factories ----------
const headMat=new THREE.MeshStandardMaterial({color:0xfffdf0,emissive:0xfff6cc,emissiveIntensity:0,roughness:.25,metalness:.1});
const tailMat=new THREE.MeshStandardMaterial({color:0x550000,emissive:0xff2200,emissiveIntensity:.4,roughness:.25,metalness:.1});
const wheelGeo=new THREE.CylinderGeometry(.45,.45,.42,14);wheelGeo.rotateZ(Math.PI/2);
const wheelMat=new THREE.MeshStandardMaterial({color:0x121212,roughness:.72,metalness:.22});
const CAR_MODELS=['sedan','sedan-sports','hatchback-sports','suv','suv-luxury','taxi','van','race'];
// GLB car (CC0 Kenney Car Kit) mapped onto the gameplay contract (wheels, beacons); falls back to procedural
function makeCar(color,cop){
  const model=assets.spawn(cop?'police':pick(CAR_MODELS));
  if(!model)return makeCarProcedural(color,cop);
  const g=new THREE.Group();
  model.rotation.y=Math.PI;            // Kenney cars face -Z; flip to our +Z forward
  model.scale.setScalar(1.9);
  model.position.y=.57;                // lift wheels (bbox min y -0.3 * scale) onto the ground
  const fronts=[],backs=[];
  model.traverse(o=>{
    if(o.isMesh){o.castShadow=true;o.receiveShadow=true;if(o.material)o.material.envMapIntensity=.7;}
    if(o.name&&o.name.indexOf('wheel')===0)(o.name.indexOf('front')>=0?fronts:backs).push(o);
  });
  g.add(model);                        // children[0] = model, so the lean/pitch tilt still works
  const ud={wheels:[...fronts,...backs],hp:100,type:'car',rad:1.6,door:null};
  if(cop){
    const rl=new THREE.Mesh(new THREE.BoxGeometry(.5,.22,.4),new THREE.MeshStandardMaterial({color:0xff0000,emissive:0xff0000,emissiveIntensity:1}));
    const bl=new THREE.Mesh(new THREE.BoxGeometry(.5,.22,.4),new THREE.MeshStandardMaterial({color:0x0044ff,emissive:0x0044ff,emissiveIntensity:1}));
    rl.position.set(-.35,2.05,-.2);bl.position.set(.35,2.05,-.2);g.add(rl,bl);
    ud.beacons=[rl,bl];
  }
  g.userData=ud;scene.add(g);return g;
}
function makeCarProcedural(color,cop){
  const g=new THREE.Group();
  const paint=new THREE.MeshStandardMaterial({color,roughness:.3,metalness:.6,envMapIntensity:1.1});
  const glass=new THREE.MeshStandardMaterial({color:0x0e151d,roughness:.05,metalness:.95,envMapIntensity:1.5,transparent:true,opacity:.6});
  const dark=new THREE.MeshStandardMaterial({color:0x15181c,roughness:.45,metalness:.35,envMapIntensity:.7});
  const body=new THREE.Mesh(new THREE.BoxGeometry(2.4,.75,5),paint);body.position.y=.75;body.castShadow=true;g.add(body);
  const hood=new THREE.Mesh(new THREE.BoxGeometry(2.3,.32,1.4),paint);hood.position.set(0,1.2,1.7);g.add(hood);
  const trunk=new THREE.Mesh(new THREE.BoxGeometry(2.3,.3,1.0),paint);trunk.position.set(0,1.19,-1.95);g.add(trunk);
  const cab=new THREE.Mesh(new THREE.BoxGeometry(2.05,.78,2.5),glass);cab.position.set(0,1.46,-.3);g.add(cab);
  const roof=new THREE.Mesh(new THREE.BoxGeometry(2.0,.08,2.2),paint);roof.position.set(0,1.88,-.3);roof.castShadow=true;g.add(roof);
  for(const bz of[2.55,-2.55]){
    const bp=new THREE.Mesh(new THREE.BoxGeometry(2.5,.3,.22),dark);bp.position.set(0,.5,bz);g.add(bp);
  }
  // driver door (left side), hinged at its front edge so it can swing open
  const doorGrp=new THREE.Group();
  const doorGeo=new THREE.BoxGeometry(.07,.62,1.45);doorGeo.translate(0,0,-.72);
  doorGrp.add(new THREE.Mesh(doorGeo,paint));
  const dwinGeo=new THREE.BoxGeometry(.05,.5,1.1);dwinGeo.translate(0,.56,-.6);
  doorGrp.add(new THREE.Mesh(dwinGeo,glass));
  doorGrp.position.set(-1.22,.78,1.05);g.add(doorGrp);
  const wheels=[];
  for(const[wx,wz]of[[-1.15,1.62],[1.15,1.62],[-1.15,-1.62],[1.15,-1.62]]){
    const w=new THREE.Mesh(wheelGeo,wheelMat);w.position.set(wx,.45,wz);g.add(w);wheels.push(w);
  }
  for(const sx of[-0.75,0.75]){
    const hl=new THREE.Mesh(new THREE.BoxGeometry(.5,.25,.1),headMat);hl.position.set(sx,.85,2.52);g.add(hl);
    const tl=new THREE.Mesh(new THREE.BoxGeometry(.5,.2,.1),tailMat);tl.position.set(sx,.85,-2.52);g.add(tl);
  }
  const ud={wheels,hp:100,type:'car',rad:1.7,paint,door:doorGrp};
  if(cop){
    const rl=new THREE.Mesh(new THREE.BoxGeometry(.5,.22,.4),new THREE.MeshPhongMaterial({color:0xff0000,emissive:0xff0000,emissiveIntensity:1}));
    const bl=new THREE.Mesh(new THREE.BoxGeometry(.5,.22,.4),new THREE.MeshPhongMaterial({color:0x0044ff,emissive:0x0044ff,emissiveIntensity:1}));
    rl.position.set(-.35,1.98,-.3);bl.position.set(.35,1.98,-.3);g.add(rl,bl);
    const stripe=new THREE.Mesh(new THREE.BoxGeometry(2.45,.3,5.02),new THREE.MeshPhongMaterial({color:0xeeeeee}));
    stripe.position.y=.62;g.add(stripe);
    ud.beacons=[rl,bl];
  }
  g.userData=ud;
  scene.add(g);return g;
}
function makeBike(color){
  const g=new THREE.Group(),lean=new THREE.Group();g.add(lean);
  const paint=new THREE.MeshStandardMaterial({color,roughness:.35,metalness:.55,envMapIntensity:1.0});
  const wheels=[];
  for(const wz of[.95,-.85]){
    const w=new THREE.Mesh(new THREE.CylinderGeometry(.42,.42,.16,10),wheelMat);
    w.geometry=w.geometry;w.rotation.z=Math.PI/2;
    const holder=new THREE.Group();holder.add(w);holder.position.set(0,.42,wz);
    lean.add(holder);wheels.push(w);
  }
  const frame=new THREE.Mesh(new THREE.BoxGeometry(.22,.2,1.5),paint);frame.position.y=.66;lean.add(frame);
  const tank=new THREE.Mesh(new THREE.BoxGeometry(.34,.26,.6),paint);tank.position.set(0,.84,.25);tank.castShadow=true;lean.add(tank);
  const seat=new THREE.Mesh(new THREE.BoxGeometry(.34,.1,.55),new THREE.MeshPhongMaterial({color:0x191919}));
  seat.position.set(0,.86,-.4);lean.add(seat);
  const bar=new THREE.Mesh(new THREE.BoxGeometry(.78,.07,.07),new THREE.MeshPhongMaterial({color:0x222222}));
  bar.position.set(0,1.08,.72);lean.add(bar);
  const fork=new THREE.Mesh(new THREE.BoxGeometry(.08,.6,.08),new THREE.MeshPhongMaterial({color:0x666666}));
  fork.position.set(0,.7,.9);fork.rotation.x=.3;lean.add(fork);
  const hl=new THREE.Mesh(new THREE.BoxGeometry(.2,.18,.08),headMat);hl.position.set(0,.95,1.05);lean.add(hl);
  const tl=new THREE.Mesh(new THREE.BoxGeometry(.18,.12,.06),tailMat);tl.position.set(0,.72,-1.05);lean.add(tl);
  g.userData={wheels,hp:55,type:'bike',rad:1.0,lean,paint};
  scene.add(g);return g;
}
function makeRickshaw(){   // Bharat auto-rickshaw (3-wheeler)
  const g=new THREE.Group();
  const yellow=new THREE.MeshStandardMaterial({color:0xf4c20d,roughness:.4,metalness:.45,envMapIntensity:.9}),green=new THREE.MeshStandardMaterial({color:0x1e7a3a,roughness:.45,metalness:.4,envMapIntensity:.8}),blk=new THREE.MeshStandardMaterial({color:0x15181c,roughness:.5,metalness:.3});
  const body=new THREE.Mesh(new THREE.BoxGeometry(1.7,1.0,2.6),yellow);body.position.y=.85;body.castShadow=true;g.add(body);
  const roof=new THREE.Mesh(new THREE.BoxGeometry(1.7,.5,2.0),green);roof.position.set(0,1.55,-.2);g.add(roof);
  const front=new THREE.Mesh(new THREE.BoxGeometry(.85,.95,.8),yellow);front.position.set(0,.85,1.45);g.add(front);
  const wheels=[];const wg=new THREE.CylinderGeometry(.42,.42,.22,12);wg.rotateZ(Math.PI/2);
  const fw=new THREE.Mesh(wg,blk);fw.position.set(0,.42,1.45);g.add(fw);wheels.push(fw);
  for(const wx of[-.78,.78]){const w=new THREE.Mesh(wg,blk);w.position.set(wx,.42,-.9);g.add(w);wheels.push(w);}
  for(const sx of[-.5,.5]){const hl=new THREE.Mesh(new THREE.BoxGeometry(.16,.16,.08),headMat);hl.position.set(sx,.95,1.86);g.add(hl);}
  g.userData={wheels,hp:55,type:'auto',rad:1.3,paint:yellow};
  scene.add(g);return g;
}

// ---------- character system (shared rounded low-poly humanoid) ----------
// geometry pivots: limbs hinge at top (hip/shoulder); rigid parts centered at rest height
// proportions: slimmer limbs, broad-shouldered tapered torso, smaller rounder head → adult, not chibi
const legGeo=new THREE.CylinderGeometry(.092,.06,.94,10);legGeo.translate(0,-.47,0);
const armGeo=new THREE.CylinderGeometry(.058,.042,.74,9);armGeo.translate(0,-.37,0);
const torsoGeo=new THREE.CylinderGeometry(.285,.155,.8,10);        // broad shoulders → narrow waist
const hipGeo=new THREE.CylinderGeometry(.155,.2,.24,10);
const headGeo=new THREE.IcosahedronGeometry(.16,2);headGeo.scale(.92,1.18,.96);
const hairGeo=new THREE.IcosahedronGeometry(.178,2);hairGeo.scale(1,.66,1.02);hairGeo.translate(0,.055,0);
const capGeo=new THREE.CylinderGeometry(.215,.215,.12,10);
const brimGeo=new THREE.BoxGeometry(.42,.05,.2);brimGeo.translate(0,0,.18);
// face decal (eyes/brows/mouth) drawn on a small transparent plane stuck to the head front
const faceGeo=new THREE.PlaneGeometry(.33,.35);
const faceTex=(()=>{
  const c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d');
  x.clearRect(0,0,64,64);
  x.strokeStyle='#3a2a1a';x.lineWidth=2;x.lineCap='round';
  x.beginPath();x.moveTo(15,23);x.lineTo(27,22);x.moveTo(37,22);x.lineTo(49,23);x.stroke();
  x.fillStyle='#fff';x.beginPath();x.ellipse(22,30,6,5,0,0,7);x.ellipse(42,30,6,5,0,0,7);x.fill();
  x.fillStyle='#1a2330';x.beginPath();x.arc(23,31,2.7,0,7);x.arc(41,31,2.7,0,7);x.fill();
  x.strokeStyle='#7a3b32';x.lineWidth=2.4;x.beginPath();x.arc(32,41,7,.15*Math.PI,.85*Math.PI);x.stroke();
  const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;return t;
})();
const faceMat=new THREE.MeshBasicMaterial({map:faceTex,transparent:true,alphaTest:.4,side:THREE.DoubleSide,depthWrite:false});
function makeGun(kind){
  const g=new THREE.Group();
  const metal=new THREE.MeshPhongMaterial({color:0x26292e,shininess:95,specular:0x999999});
  const dark=new THREE.MeshPhongMaterial({color:0x141519,shininess:35});
  const wood=new THREE.MeshPhongMaterial({color:0x5a3a22,shininess:22});
  const add=(w,h,d,mat,x,y,z)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);g.add(m);};
  if(kind==='uzi'){
    add(.09,.15,.46,metal,0,0,.13);    // receiver
    add(.05,.05,.34,dark,0,.03,.42);   // barrel
    add(.07,.24,.09,dark,0,-.18,.03);  // magazine
    add(.06,.14,.09,dark,0,-.11,-.13); // grip
    add(.04,.06,.03,dark,0,.11,.02);   // sight
    g.userData.muzzle=.6;
  }else if(kind==='shotgun'){
    add(.07,.09,.82,metal,0,.01,.26);  // barrel
    add(.06,.07,.52,dark,0,-.07,.18);  // pump tube
    add(.08,.17,.36,wood,0,-.05,-.27); // stock
    add(.06,.13,.09,wood,0,-.1,.01);   // grip
    g.userData.muzzle=.72;
  }else{ // pistol
    add(.07,.14,.34,metal,0,.02,.12);  // slide
    add(.055,.05,.38,dark,0,.07,.15);  // barrel rib
    add(.06,.17,.1,dark,0,-.11,-.05);  // grip
    add(.05,.05,.08,dark,0,-.04,.02);  // trigger guard
    g.userData.muzzle=.36;
  }
  return g;
}
// rest offsets / joint positions (must match the matrix math in updateCrowd)
const REST={torso:1.22,hip:.96,head:1.79,hair:1.84};
const JOINT={legL:[-.12,.94,0],legR:[.12,.94,0],armL:[-.30,1.55,.02],armR:[.30,1.55,.02]};
// colour palettes
const SKINc=[0xe8b88f,0xd9a173,0xc28e63,0x9c6a43,0x7a4a2b];
const SHIRTc=[0xc0392b,0x2980b9,0x27ae60,0xf39c12,0x8e44ad,0xecf0f1,0x34495e,0xe056a0,0x16a085,0xd35400,0x2c3e50];
const PANTSc=[0x2c3e50,0x5d4037,0x37474f,0x4e342e,0x1b2631,0x4b5563];
const HAIRc=[0x2b1b0e,0x4a2f17,0x141414,0x6b4423,0x8a8a8a,0xb8902f];
const SKIN=SKINc.map(c=>new THREE.Color(c)),SHIRT=SHIRTc.map(c=>new THREE.Color(c)),
      PANTS=PANTSc.map(c=>new THREE.Color(c)),HAIR=HAIRc.map(c=>new THREE.Color(c));

function buildCharacter(skin,shirt,pants,hair,cop){
  const g=new THREE.Group();
  const mk=(geo,col,sh)=>{const m=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color:col,roughness:.8,metalness:.05,envMapIntensity:.18}));m.castShadow=sh;return m;};
  const lL=mk(legGeo,pants,1),lR=mk(legGeo,pants,1);
  lL.position.set(JOINT.legL[0],JOINT.legL[1],0);lR.position.set(JOINT.legR[0],JOINT.legR[1],0);
  const hip=mk(hipGeo,pants,1);hip.position.y=REST.hip;
  const torso=mk(torsoGeo,shirt,1);torso.position.y=REST.torso;
  const aL=mk(armGeo,shirt,0),aR=mk(armGeo,shirt,0);
  aL.position.set(JOINT.armL[0],JOINT.armL[1],0);aR.position.set(JOINT.armR[0],JOINT.armR[1],0);
  const head=mk(headGeo,skin,1);head.position.y=REST.head;
  const hairM=mk(hairGeo,cop?0x141414:hair,0);hairM.position.y=REST.hair;
  const face=new THREE.Mesh(faceGeo,faceMat);face.position.set(0,REST.head,.2);
  g.add(lL,lR,hip,torso,aL,aR,head,hairM,face);
  if(cop){
    const cap=mk(capGeo,0x0a192f,0);cap.position.y=1.96;
    const brim=mk(brimGeo,0x0a192f,0);brim.position.y=1.93;
    cap.add(brim);g.add(cap);
    const badge=mk(new THREE.BoxGeometry(.12,.18,.02),0xf1c40f,0);badge.position.set(.13,1.28,.2);g.add(badge);
  }
  // gun held in the right hand; the mount rotates with the aim (camera yaw)
  const gunMount=new THREE.Group();gunMount.position.set(0,1.42,0);
  const guns={pistol:makeGun('pistol'),uzi:makeGun('uzi'),shotgun:makeGun('shotgun')};
  for(const kk in guns){guns[kk].position.set(.17,-.04,.42);guns[kk].scale.setScalar(1.1);guns[kk].visible=false;gunMount.add(guns[kk]);}
  gunMount.visible=false;g.add(gunMount);
  g.userData.limbs=[lL,lR,aL,aR];g.userData.gunMount=gunMount;g.userData.guns=guns;
  return g;
}
function makeCiv(cop){return buildCharacter(pick(SKINc),cop?0x1e3799:pick(SHIRTc),cop?0x0a192f:pick(PANTSc),pick(HAIRc),cop);}
// lighter "seated bust" for vehicle occupants (legs hidden in the cabin → omit them)
function buildOccupant(cop){
  const g=new THREE.Group();
  const shirt=cop?0x1e3799:pick(SHIRTc),skin=pick(SKINc),hair=cop?0x141414:pick(HAIRc);
  const mk=(geo,col)=>new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color:col,roughness:.8,metalness:.05,envMapIntensity:.18}));
  const torso=mk(torsoGeo,shirt);torso.position.y=REST.torso;torso.castShadow=true;
  const aL=mk(armGeo,shirt),aR=mk(armGeo,shirt);
  aL.position.set(JOINT.armL[0],JOINT.armL[1],0);aR.position.set(JOINT.armR[0],JOINT.armR[1],0);
  const head=mk(headGeo,skin);head.position.y=REST.head;
  const hairM=mk(hairGeo,hair);hairM.position.y=REST.hair;
  const face=new THREE.Mesh(faceGeo,faceMat);face.position.set(0,REST.head,.2);
  g.add(torso,aL,aR,head,hairM,face);
  if(cop){const cap=mk(capGeo,0x0a192f);cap.position.y=1.96;g.add(cap);}
  g.userData.limbs=[null,null,aL,aR];
  return g;
}
function pose(mesh,seated){
  const L=mesh.userData.limbs;if(!L)return;
  if(L[0]){L[0].rotation.x=L[1].rotation.x=seated?1.2:0;}
  L[2].rotation.x=L[3].rotation.x=seated?-.8:0;
}

// ---------- instanced crowd (one InstancedMesh per body part → fixed draw calls) ----------
const MAXP=220;
function instPart(geo,sh){
  const m=new THREE.InstancedMesh(geo,new THREE.MeshStandardMaterial({color:0xffffff,roughness:.82,metalness:.05,envMapIntensity:.18}),MAXP);
  m.castShadow=sh;m.receiveShadow=false;m.frustumCulled=false;
  m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);scene.add(m);return m;
}
const iLegL=instPart(legGeo,1),iLegR=instPart(legGeo,1),iHip=instPart(hipGeo,1),
      iTorso=instPart(torsoGeo,1),iArmL=instPart(armGeo,0),iArmR=instPart(armGeo,0),
      iHead=instPart(headGeo,1),iHair=instPart(hairGeo,0);
const iFace=new THREE.InstancedMesh(faceGeo,faceMat,MAXP);
iFace.frustumCulled=false;iFace.instanceMatrix.setUsage(THREE.DynamicDrawUsage);scene.add(iFace);
const CROWD=[iLegL,iLegR,iHip,iTorso,iArmL,iArmR,iHead,iHair,iFace];
const _zero=new THREE.Matrix4().makeScale(0,0,0);
for(let i=0;i<MAXP;i++)for(const m of CROWD)m.setMatrixAt(i,_zero);
let colorsDirty=false;
function setCrowdColor(i,skin,shirt,pants,hair){
  iHead.setColorAt(i,skin);iHair.setColorAt(i,hair);
  iTorso.setColorAt(i,shirt);iArmL.setColorAt(i,shirt);iArmR.setColorAt(i,shirt);
  iHip.setColorAt(i,pants);iLegL.setColorAt(i,pants);iLegR.setColorAt(i,pants);
  colorsDirty=true;
}
// scratch matrices reused every frame (no per-frame allocation)
const _R=new THREE.Matrix4(),_J=new THREE.Matrix4(),_W=new THREE.Matrix4(),_Rx=new THREE.Matrix4(),
      _q=new THREE.Quaternion(),_e=new THREE.Euler(),_pos=new THREE.Vector3(),_one=new THREE.Vector3(1,1,1);
const _oTorso=new THREE.Matrix4().makeTranslation(0,REST.torso,0),
      _oHip=new THREE.Matrix4().makeTranslation(0,REST.hip,0),
      _oHead=new THREE.Matrix4().makeTranslation(0,REST.head,0),
      _oHair=new THREE.Matrix4().makeTranslation(0,REST.hair,0),
      _oFace=new THREE.Matrix4().makeTranslation(0,REST.head,.2),
      _jLegL=new THREE.Matrix4().makeTranslation(...JOINT.legL),
      _jLegR=new THREE.Matrix4().makeTranslation(...JOINT.legR),
      _jArmL=new THREE.Matrix4().makeTranslation(...JOINT.armL),
      _jArmR=new THREE.Matrix4().makeTranslation(...JOINT.armR);
function _rigid(mesh,i,off){_W.multiplyMatrices(_R,off);mesh.setMatrixAt(i,_W);}
function _limb(mesh,i,joint,swing){_Rx.makeRotationX(swing);_J.multiplyMatrices(joint,_Rx);_W.multiplyMatrices(_R,_J);mesh.setMatrixAt(i,_W);}
function updateCrowd(){
  for(let i=0;i<peds.length;i++){
    const p=peds[i];
    if(p.state==='down'){_e.set(1.5,p.dyaw,0);_pos.set(p.x,.3,p.z);}
    else{_e.set(0,p.heading,0);_pos.set(p.x,p.bob,p.z);}
    _q.setFromEuler(_e);_R.compose(_pos,_q,_one);
    const sw=p.sw;
    _limb(iLegL,i,_jLegL,sw*.6);_limb(iLegR,i,_jLegR,-sw*.6);
    _limb(iArmL,i,_jArmL,-sw*.5);_limb(iArmR,i,_jArmR,sw*.5);
    _rigid(iHip,i,_oHip);_rigid(iTorso,i,_oTorso);_rigid(iHead,i,_oHead);_rigid(iHair,i,_oHair);_rigid(iFace,i,_oFace);
  }
  for(const m of CROWD)m.instanceMatrix.needsUpdate=true;
  if(colorsDirty){for(const m of CROWD)if(m.instanceColor)m.instanceColor.needsUpdate=true;colorsDirty=false;}
}

// ---------- audio ----------
let actx=null,eng={},noiseBuf=null,skidGain=null;
function initAudio(){
  if(actx)return;
  try{
    actx=new (window.AudioContext||window.webkitAudioContext)();
    const o=actx.createOscillator();o.type='sawtooth';o.frequency.value=70;
    const lp=actx.createBiquadFilter();lp.type='lowpass';lp.frequency.value=420;
    const g=actx.createGain();g.gain.value=0;
    o.connect(lp).connect(g).connect(actx.destination);o.start();
    eng={o,g};
    noiseBuf=actx.createBuffer(1,actx.sampleRate*.5,actx.sampleRate);
    const d=noiseBuf.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;
    const ns=actx.createBufferSource();ns.buffer=noiseBuf;ns.loop=true;
    skidGain=actx.createGain();skidGain.gain.value=0;
    const bp=actx.createBiquadFilter();bp.type='bandpass';bp.frequency.value=900;
    ns.connect(bp).connect(skidGain).connect(actx.destination);ns.start();
    const so=actx.createOscillator();so.type='triangle';so.frequency.value=700;
    const sg=actx.createGain();sg.gain.value=0;
    so.connect(sg).connect(actx.destination);so.start();
    eng.siren=so;eng.sirenG=sg;
    const ho=actx.createOscillator();ho.type='square';ho.frequency.value=392;
    const hg=actx.createGain();hg.gain.value=0;
    ho.connect(hg).connect(actx.destination);ho.start();
    eng.hornG=hg;
  }catch(e){}
}
function crashSound(i){
  if(!actx)return;
  const s=actx.createBufferSource();s.buffer=noiseBuf;
  const g=actx.createGain();g.gain.setValueAtTime(Math.min(.5,i*.6),actx.currentTime);
  g.gain.exponentialRampToValueAtTime(.001,actx.currentTime+.25);
  const lp=actx.createBiquadFilter();lp.type='lowpass';lp.frequency.value=600;
  s.connect(lp).connect(g).connect(actx.destination);s.start();s.stop(actx.currentTime+.3);
}
function gunSound(){
  if(!actx)return;
  const s=actx.createBufferSource();s.buffer=noiseBuf;
  const g=actx.createGain();g.gain.setValueAtTime(.22,actx.currentTime);
  g.gain.exponentialRampToValueAtTime(.001,actx.currentTime+.09);
  const hp=actx.createBiquadFilter();hp.type='highpass';hp.frequency.value=1200;
  s.connect(hp).connect(g).connect(actx.destination);s.start();s.stop(actx.currentTime+.1);
}
function chime(){
  if(!actx)return;
  [880,1320].forEach((f,i)=>{
    const o=actx.createOscillator();o.frequency.value=f;
    const g=actx.createGain();g.gain.setValueAtTime(.15,actx.currentTime+i*.12);
    g.gain.exponentialRampToValueAtTime(.001,actx.currentTime+i*.12+.3);
    o.connect(g).connect(actx.destination);o.start(actx.currentTime+i*.12);o.stop(actx.currentTime+i*.12+.35);
  });
}

// ---------- input ----------
const keys={};
let started=false,firing=false,pressedE=false,talkReq=false;
let camYaw=0,camPitch=.12,lastMouse=-9,pointerLocked=false;
let talkingPed=null;
const TALK=['Namaste! Kaise ho?','Arre, dekh ke chalo, bhai!','Try the chaat at the food court, first class!',
  'Traffic is mad today, na?','Bhai, which way to Connaught Place?','Police are everywhere these days, yaar.',
  'Kya scene hai? Nice weather for a stroll.','Mind your own work, ji.','Auto! Auto! ...oh, not for me.',
  'Jai Hind! \u{1F1EE}\u{1F1F3}','Chai pi lo, fir baat karte hain.','Yeh sheher kabhi sota nahi.'];
function findNearestPed(r){let best=null,bd=r;for(const p of peds){if(p.state==='down'||p.state==='talk')continue;
  const d=Math.hypot(p.x-player.x,p.z-player.z);if(d<bd){bd=d;best=p;}}return best;}
addEventListener('keydown',e=>{
  if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code))e.preventDefault();
  keys[e.code]=true;start();
  if(e.code==='KeyM')toggleMap();
  if(e.code==='KeyQ')cycleWeapon();
  if(e.code==='KeyE')pressedE=true;
  if(e.code==='KeyT')talkReq=true;
});
addEventListener('keyup',e=>keys[e.code]=false);
const canvasEl=renderer.domElement;
canvasEl.addEventListener('click',()=>{if(started&&!bigOpen&&!document.pointerLockElement&&canvasEl.requestPointerLock)canvasEl.requestPointerLock();});
document.addEventListener('pointerlockchange',()=>{pointerLocked=document.pointerLockElement===canvasEl;});
addEventListener('mousemove',e=>{
  if(!started)return;
  camYaw-=e.movementX*0.0026;
  camPitch=M.clamp(camPitch+e.movementY*0.0024,-0.5,1.0);
  lastMouse=perf;
});
addEventListener('mousedown',()=>{if(started&&!bigOpen)firing=true;start();});
addEventListener('mouseup',()=>firing=false);
function start(){if(started||!assetsReady)return;started=true;initAudio();document.getElementById('intro').style.display='none';
  // grab pointer lock on start so the mouse gives unbounded 360° look (first click hits #intro, not the canvas)
  if(canvasEl.requestPointerLock)canvasEl.requestPointerLock();}
const inp=()=>({
  up:keys.KeyW||keys.ArrowUp, dn:keys.KeyS||keys.ArrowDown,
  lf:keys.KeyA||keys.ArrowLeft, rt:keys.KeyD||keys.ArrowRight,
  hb:keys.Space, boost:keys.ShiftLeft||keys.ShiftRight, horn:keys.KeyH
});

// ---------- game state ----------
let money=500,wanted=0,crimeCool=0,wantedTimer=0,playerHp=100;
let tod=.32;
const player={x:spawnX+5,z:spawnZ-4,vx:0,vz:0,heading:Math.PI/2,inCar:false,steer:0};
const char=buildCharacter(0xe8b88f,0x223a5e,0x222831,0x2b1b0e,false);scene.add(char);char.position.set(player.x,0,player.z);
let vehicle=null,exitCool=0,dead=false;
// you start on foot — your yellow car waits at the curb, a bike across the street
const parked=[];   // populated by boot() once vehicle GLB models have loaded

// ---------- weapons ----------
const WEAPONS={
  pistol:{rate:.32,dmg:40,n:1,spread:.015,ammo0:36},
  uzi:{rate:.09,dmg:22,n:1,spread:.05,ammo0:120},
  shotgun:{rate:.85,dmg:30,n:6,spread:.16,ammo0:18}
};
let owned=['fist'],curW=0,ammo={};
function weaponHUD(){
  const w=owned[curW];
  document.getElementById('weapon').textContent=w==='fist'?'FISTS':w.toUpperCase()+'  '+ammo[w];
  document.getElementById('xh').style.display=w==='fist'?'none':'block';
}
function cycleWeapon(){curW=(curW+1)%owned.length;weaponHUD();}
function giveWeapon(w){
  if(!owned.includes(w)){owned.push(w);curW=owned.length-1;}
  ammo[w]=(ammo[w]||0)+WEAPONS[w].ammo0;
  chime();showMsg(w.toUpperCase()+' acquired!');weaponHUD();
}
// pickups
const pickups=[];
const gunMat=new THREE.MeshPhongMaterial({color:0x2ecc71,emissive:0x2ecc71,emissiveIntensity:.5});
function spawnPickup(px,pz,kind){
  const g=new THREE.Group();
  const b1=new THREE.Mesh(new THREE.BoxGeometry(.9,.3,.3),gunMat);
  const b2=new THREE.Mesh(new THREE.BoxGeometry(.25,.5,.25),gunMat);b2.position.set(-.25,-.3,0);
  g.add(b1,b2);
  if(px===undefined){const it=pick(inters);px=it.x+HALF+rnd(1,3);pz=it.z+HALF+rnd(1,3);}
  g.position.set(px,1.1,pz);
  g.userData.kind=kind||pick(['pistol','pistol','uzi','shotgun']);
  scene.add(g);pickups.push(g);
}
for(let i=0;i<12;i++)spawnPickup();
spawnPickup(spawnX+5,spawnZ-4,'pistol');   // starter weapon right where you begin
// bullets
const bullets=[];
const bulletGeo=new THREE.BoxGeometry(.09,.09,.55);
const bulletMatY=new THREE.MeshBasicMaterial({color:0xffdd66});
function shoot(x,y,z,ang,from,dmg){
  if(bullets.length>50)return;
  const m=new THREE.Mesh(bulletGeo,bulletMatY);
  m.position.set(x,y,z);m.rotation.y=ang;scene.add(m);
  bullets.push({m,vx:Math.sin(ang)*1.6,vz:Math.cos(ang)*1.6,life:.55,from,dmg});
  gunSound();
}

// ---------- traffic (cars + bikes, with drivers/riders) ----------
const aiCars=[];
function laneOff(axis,dir){return axis==='z'?dir*LANE:-dir*LANE;}
function spawnAI(forceBike){
  const axis=Math.random()<.5?'z':'x';
  const line=axis==='z'?pick(cityX):pick(cityZ);
  const dir=Math.random()<.5?1:-1;
  const bike=forceBike!==undefined?forceBike:Math.random()<.18;
  const auto=!bike&&forceBike===undefined&&Math.random()<.22;
  const color=pick([0xc0392b,0x2980b9,0x27ae60,0xe67e22,0x95a5a6,0x8e44ad,0xf1f1f1,0x2c3e50]);
  const m=bike?makeBike(color):auto?makeRickshaw():makeCar(color,false);
  const occupant=buildOccupant(false);pose(occupant,true);
  if(bike){m.userData.lean.add(occupant);occupant.position.set(0,.5,-.3);}
  else{occupant.scale.setScalar(.85);occupant.position.set(auto?0:-.45,.18,auto?-.3:-.2);m.add(occupant);}
  const along=rnd(line.a+15,line.b-15);
  if(axis==='z')m.position.set(line.c+laneOff(axis,dir),0,along);
  else m.position.set(along,0,line.c+laneOff(axis,dir));
  m.rotation.y=axis==='z'?(dir>0?0:Math.PI):(dir>0?Math.PI/2:-Math.PI/2);
  aiCars.push({mesh:m,axis,dir,line,cur:0,base:rnd(.3,.5),occupant,jacked:false});
}
// vehicle spawns are deferred until GLB models load (called by runBoot, gated by start())
function boot(){
  const playerCar=makeCar(0xffcc00,false);playerCar.position.set(spawnX+LANE,0,spawnZ-7);
  const playerBike=makeBike(0xcc2222);playerBike.position.set(spawnX-LANE-1,0,spawnZ+8);playerBike.rotation.y=Math.PI;
  parked.push(playerCar,playerBike);
  for(let i=0;i<30;i++)spawnAI(false);
  for(let i=0;i<8;i++)spawnAI(true);
}
// idle officers stationed inside each police station
for(const Lm of landmarks)if(Lm.type==='police'){
  for(let i=0;i<3;i++){const c=makeCiv(true);
    c.position.set(Lm.x+rnd(-Lm.hw*.5,Lm.hw*.5),0,Lm.z+rnd(-Lm.hd*.5,Lm.hd*.5));
    c.rotation.y=rnd(0,7);scene.add(c);}
}

function aiUpdate(ai,dtF){
  const m=ai.mesh,L=ai.line;
  const pos=ai.axis==='z'?m.position.z:m.position.x;
  let next=null,nextLine=null;
  if(ai.dir>0){for(const W of L.cross)if(W.c>pos+.1){next=W.c;nextLine=W;break;}}
  else{for(let i=L.cross.length-1;i>=0;i--)if(L.cross[i].c<pos-.1){next=L.cross[i].c;nextLine=L.cross[i];break;}}
  let target=ai.jacked?0:ai.base;
  if(next!==null){
    const dist=(next-pos)*ai.dir-HALF-2;
    const st=lightState(ai.axis);
    if((st==='R'||st==='Y')&&dist<16&&dist>-1)target=Math.max(0,(dist-2)/16)*ai.base;
  }
  for(const o of aiCars){
    if(o===ai||o.axis!==ai.axis||o.dir!==ai.dir||Math.abs(o.line.c-L.c)>1)continue;
    const op=ai.axis==='z'?o.mesh.position.z:o.mesh.position.x;
    const gap=(op-pos)*ai.dir;
    if(gap>0&&gap<11)target=Math.min(target,gap<5.5?0:o.cur*.9);
  }
  // brake for the player (in a car OR standing on the road) and for pedestrians
  {
    const gap=ai.axis==='z'?(player.z-pos)*ai.dir:(player.x-pos)*ai.dir;
    const side=ai.axis==='z'?Math.abs(player.x-m.position.x):Math.abs(player.z-m.position.z);
    if(gap>0&&gap<14&&side<3.2)target=Math.min(target,gap<7?0:.15);
  }
  for(const p of peds){
    if(p.state==='down')continue;
    const gap=ai.axis==='z'?(p.z-pos)*ai.dir:(p.x-pos)*ai.dir;
    if(gap<0||gap>9)continue;
    const side=ai.axis==='z'?Math.abs(p.x-m.position.x):Math.abs(p.z-m.position.z);
    if(side<2.2)target=Math.min(target,gap<5?0:.12);
  }
  ai.cur+=M.clamp(target-ai.cur,-.05*dtF,.015*dtF);
  const newPos=pos+ai.dir*ai.cur*dtF;
  if(ai.axis==='z')m.position.z=newPos;else m.position.x=newPos;
  // turn at intersections (after moving, so newPos applied to the old axis)
  if(nextLine&&(next-pos)*ai.dir>0&&(next-newPos)*ai.dir<=0&&Math.random()<.45){
    ai.line=nextLine;ai.axis=ai.axis==='z'?'x':'z';ai.dir=Math.random()<.5?1:-1;
    if(ai.axis==='x')m.position.z=nextLine.c+laneOff('x',ai.dir);
    else m.position.x=nextLine.c+laneOff('z',ai.dir);
  }
  // dead end / world edge: u-turn
  const along=ai.axis==='z'?m.position.z:m.position.x;
  if(ai.dir>0&&along>ai.line.b-6)ai.dir=-1;
  if(ai.dir<0&&along<ai.line.a+6)ai.dir=1;
  const lane=ai.line.c+laneOff(ai.axis,ai.dir);
  if(ai.axis==='z')m.position.x+=(lane-m.position.x)*.06*dtF;
  else m.position.z+=(lane-m.position.z)*.06*dtF;
  const tA=ai.axis==='z'?(ai.dir>0?0:Math.PI):(ai.dir>0?Math.PI/2:-Math.PI/2);
  let dA=tA-m.rotation.y;while(dA>Math.PI)dA-=2*Math.PI;while(dA<-Math.PI)dA+=2*Math.PI;
  m.rotation.y+=dA*.12*dtF;
  m.userData.wheels.forEach(w=>w.rotation.x+=ai.cur*.6*dtF);
}

// ---------- pedestrians ----------
const peds=[];
function spawnPed(){
  if(peds.length>=MAXP)return;
  const axis=Math.random()<.5?'z':'x';
  const line=axis==='z'?pick(cityX):pick(cityZ);
  const off=(Math.random()<.5?1:-1)*(HALF-1.4),pos=rnd(line.a+12,line.b-12);
  const i=peds.length;
  peds.push({axis,line,off,pos,dir:Math.random()<.5?1:-1,speed:rnd(.045,.075),
    state:'walk',t:Math.random()*9,timer:0,local:false,sw:0,bob:0,dyaw:0,heading:0,
    x:axis==='z'?line.c+off:pos,z:axis==='z'?pos:line.c+off});
  setCrowdColor(i,pick(SKIN),pick(SHIRT),pick(PANTS),pick(HAIR));
}
for(let i=0;i<130;i++)spawnPed();
function downPed(p){
  if(p.state==='down')return;
  p.state='down';p.timer=12;p.dyaw=Math.random()*7;p.sw=0;
  spawnBlood({x:p.x,z:p.z});
}
// a driver thrown from a stolen vehicle becomes a crowd ped lying in the road
function thrownPed(x,z){
  let p,i;
  if(peds.length<MAXP){i=peds.length;p={};peds.push(p);setCrowdColor(i,pick(SKIN),pick(SHIRT),pick(PANTS),pick(HAIR));}
  else{i=0;let bd=-1;for(let k=0;k<peds.length;k++){const q=peds[k],dd=(q.x-player.x)**2+(q.z-player.z)**2;if(dd>bd){bd=dd;i=k;}}p=peds[i];}
  Object.assign(p,{axis:'z',line:cityX[midX],off:HALF-1.4,x,z,pos:z,dir:1,speed:.06,
    state:'down',t:0,timer:2.4,local:true,sw:0,bob:0,dyaw:Math.random()*7,heading:0});
}
function pedUpdate(p,dtF){
  if(p.state==='talk'){
    p.talkT-=dtF/60;p.sw=0;p.bob=0;
    p.heading=Math.atan2(player.x-p.x,player.z-p.z);
    if(p.talkT<=0){p.state='walk';if(talkingPed===p)talkingPed=null;}
    return;
  }
  if(p.state==='down'){
    p.timer-=dtF/60;
    if(p.timer<=0){
      if(p.local){p.local=false;p.state='flee';p.timer=2.5;}
      else{p.state='walk';p.line=p.axis==='z'?pick(cityX):pick(cityZ);
        p.pos=rnd(p.line.a+12,p.line.b-12);
        p.x=p.axis==='z'?p.line.c+p.off:p.pos;p.z=p.axis==='z'?p.pos:p.line.c+p.off;}
    }
    p.sw=0;p.bob=0;return;
  }
  const dx=p.x-player.x,dz=p.z-player.z,d=Math.hypot(dx,dz);
  const pSpeed=Math.hypot(player.vx,player.vz);
  if(p.state==='walk'&&d<9&&pSpeed>.3&&player.inCar){p.state='flee';p.timer=2.5;}
  if(p.state==='flee'){
    p.timer-=dtF/60;
    const ang=Math.atan2(dx,dz);
    const pp={x:p.x+Math.sin(ang)*.16*dtF,z:p.z+Math.cos(ang)*.16*dtF,vx:0,vz:0};
    resolveCircle(pp,.4);p.x=pp.x;p.z=pp.z;p.heading=ang;p.t+=.4*dtF;
    if(p.timer<=0){p.state='walk';p.pos=p.axis==='z'?p.z:p.x;p.off=(p.axis==='z'?p.x:p.z)-p.line.c;}
  }else{
    p.pos+=p.dir*p.speed*dtF;p.t+=.18*dtF;
    if(p.pos>p.line.b-8||p.pos<p.line.a+8)p.dir*=-1;
    if(p.axis==='z'){p.x=p.line.c+p.off;p.z=p.pos;p.heading=p.dir>0?0:Math.PI;}
    else{p.x=p.pos;p.z=p.line.c+p.off;p.heading=p.dir>0?Math.PI/2:-Math.PI/2;}
  }
  const sn=Math.sin(p.t*6);p.sw=sn;p.bob=Math.abs(sn)*.045;
  if(player.inCar&&vehicle&&d<(vehicle.userData.type==='bike'?1.4:1.9)&&pSpeed>.22){
    downPed(p);crashSound(.5);
    if(crimeCool<=0){addWanted(1);crimeCool=2;}
  }
}

// ---------- police: cars + foot cops ----------
const cops=[],footCops=[];
function spawnCop(){
  const ang=Math.random()*Math.PI*2,d=rnd(90,140);
  const m=makeCar(0x0d0d0d,true);
  m.position.set(M.clamp(player.x+Math.sin(ang)*d,-WORLD+20,WORLD-20),0,
                 M.clamp(player.z+Math.cos(ang)*d,-WORLD+20,WORLD-20));
  const officer=buildOccupant(true);pose(officer,true);officer.scale.setScalar(.85);
  officer.position.set(-.45,.18,-.2);m.add(officer);
  cops.push({mesh:m,vx:0,vz:0,heading:Math.random()*7,deployed:false,idx:cops.length});
}
function spawnFootCop(x,z){
  footCops.push({mesh:(()=>{const m=makeCiv(true);scene.add(m);m.position.set(x,0,z);return m;})(),t:rnd(.5,1.4),walk:0,arrestT:0});
}
function addWanted(n){wanted=Math.min(5,wanted+n);wantedTimer=22;updateStars();}
function updateStars(){
  const el=document.getElementById('stars');
  let s='';for(let i=0;i<5;i++)s+=`<span class="${i<wanted?'on':'off'}">★</span>`;
  el.innerHTML=s;el.classList.toggle('hot',wanted>0);
}
let vigO=0;
function hitFlash(a){vigO=Math.max(vigO,a);}
updateStars();
function clearCops(){
  for(const c of cops)scene.remove(c.mesh);cops.length=0;
  for(const f of footCops)scene.remove(f.mesh);footCops.length=0;
}
function copUpdate(c,dtF){
  const m=c.mesh;
  // flank target: each cruiser aims at a slightly different point around you
  const fl=(c.idx%3-1)*5;
  const tx=player.x+Math.cos(c.heading)*fl, tz=player.z-Math.sin(c.heading)*fl;
  const want=Math.atan2(tx-m.position.x,tz-m.position.z);
  let dA=want-c.heading;while(dA>Math.PI)dA-=2*Math.PI;while(dA<-Math.PI)dA+=2*Math.PI;
  c.heading+=M.clamp(dA,-.04*dtF,.04*dtF);
  const fx=Math.sin(c.heading),fz=Math.cos(c.heading);
  let vf=c.vx*fx+c.vz*fz,vl=c.vx*fz-c.vz*fx;
  const d=Math.hypot(player.x-m.position.x,player.z-m.position.z);
  const pSpeed=Math.hypot(player.vx,player.vz);
  // pull over next to you instead of orbiting when you're slow
  if(d<8&&pSpeed<.35)vf*=Math.pow(.9,dtF);
  else vf=Math.min(vf+.016*dtF,.95);
  vl*=Math.pow(.85,dtF);
  c.vx=fx*vf+fz*vl;c.vz=fz*vf-fx*vl;
  const pp={x:m.position.x+c.vx*dtF,z:m.position.z+c.vz*dtF,vx:c.vx,vz:c.vz};
  if(resolveCircle(pp,1.6)>0.05)c.heading+=rnd(-.5,.5);
  c.vx=pp.vx;c.vz=pp.vz;
  m.position.x=M.clamp(pp.x,-WORLD+5,WORLD-5);m.position.z=M.clamp(pp.z,-WORLD+5,WORLD-5);
  m.rotation.y=c.heading;
  m.userData.wheels.forEach(w=>w.rotation.x+=vf*.6*dtF);
  const fln=Math.sin(perf*18)>0;
  m.userData.beacons[0].material.emissiveIntensity=fln?2:.1;
  m.userData.beacons[1].material.emissiveIntensity=fln?.1:2;
  // officer steps out when you're cornered
  if(!c.deployed&&d<11&&pSpeed<.3&&footCops.length<4){
    c.deployed=true;
    spawnFootCop(m.position.x+fz*1.8,m.position.z-fx*1.8);
  }
  if(d>30)c.deployed=false;
  // ram only while you're actually fleeing
  if(vehicle&&player.inCar){
    const dx=vehicle.position.x-m.position.x,dz=vehicle.position.z-m.position.z,dd=Math.hypot(dx,dz);
    const rr=vehicle.userData.rad+1.7;
    if(dd<rr+1.2){
      const rel=Math.hypot(c.vx-player.vx,c.vz-player.vz);
      const nx=dx/(dd||1),nz=dz/(dd||1);
      player.vx+=nx*rel*.55;player.vz+=nz*rel*.55;
      c.vx-=nx*rel*.4;c.vz-=nz*rel*.4;
      vehicle.position.x+=nx*(rr+1.2-dd)*.6;vehicle.position.z+=nz*(rr+1.2-dd)*.6;
      if(rel>.3){damageVehicle(rel*14);crashSound(rel);sparks(vehicle.position);}
    }
  }
}
function nearestPoliceDist(){
  let m=1e9;
  for(const c of cops)m=Math.min(m,Math.hypot(c.mesh.position.x-player.x,c.mesh.position.z-player.z));
  for(const f of footCops)m=Math.min(m,Math.hypot(f.mesh.position.x-player.x,f.mesh.position.z-player.z));
  return m;
}
function policeNear(r){return nearestPoliceDist()<r;}
function footCopUpdate(f,dtF){
  const m=f.mesh;
  const dx=player.x-m.position.x,dz=player.z-m.position.z,d=Math.hypot(dx,dz);
  if(d>80||wanted===0){scene.remove(m);return false;}
  const ang=Math.atan2(dx,dz);m.rotation.y=ang;
  const pSpeed=Math.hypot(player.vx,player.vz);
  // arrest sequence: walked up, opened the door — now hauling you out
  if(f.arrestT>0){
    f.arrestT-=dtF/60;
    if(pSpeed>.4){f.arrestT=0;}            // you sped off, arrest aborted
    else if(f.arrestT<=0){bustedNow();return true;}
    return true;
  }
  if(d>1.2){
    const pp={x:m.position.x+Math.sin(ang)*.115*dtF,z:m.position.z+Math.cos(ang)*.115*dtF,vx:0,vz:0};
    resolveCircle(pp,.4);
    m.position.x=pp.x;m.position.z=pp.z;
    f.walk+=.25*dtF;
    const s=Math.sin(f.walk*6),L=m.userData.limbs;
    L[0].rotation.x=s*.6;L[1].rotation.x=-s*.6;L[2].rotation.x=-s*.5;L[3].rotation.x=s*.5;
  }
  // reached you & you're stopped: open the car door first, THEN bust (on foot = grab)
  if(d<1.6&&pSpeed<.25){
    if(player.inCar&&vehicle){openDoor(vehicle,perf+1.4);f.arrestT=1.0;showMsg('Step out of the vehicle!');}
    else f.arrestT=.55;
  }
  // at 2+ stars they open fire
  if(wanted>=2){
    f.t-=dtF/60;
    if(f.t<=0&&d<26){f.t=1.4;shoot(m.position.x,1.3,m.position.z,ang+rnd(-.06,.06),'cop',9);}
  }
  return true;
}

// ---------- collision ----------
function resolveCircle(p,r){
  let imp=0;
  for(const b of colliders){
    const cx=M.clamp(p.x,b.x0,b.x1),cz=M.clamp(p.z,b.z0,b.z1);
    let dx=p.x-cx,dz=p.z-cz;const d2=dx*dx+dz*dz;
    if(d2<r*r){
      let d=Math.sqrt(d2);
      if(d<1e-4){
        const pl=p.x-b.x0,pr=b.x1-p.x,pt=p.z-b.z0,pb=b.z1-p.z,mn=Math.min(pl,pr,pt,pb);
        dx=mn===pl?-1:mn===pr?1:0;dz=mn===pt?-1:mn===pb?1:0;d=0;
      }else{dx/=d;dz/=d;}
      p.x+=dx*(r-d);p.z+=dz*(r-d);
      const vn=p.vx*dx+p.vz*dz;
      if(vn<0){p.vx-=vn*dx*1.35;p.vz-=vn*dz*1.35;imp=Math.max(imp,-vn);}
    }
  }
  return imp;
}
function pointInBuilding(x,z){
  for(const b of colliders)if(x>b.x0&&x<b.x1&&z>b.z0&&z<b.z1)return true;
  return false;
}
// push a moving point out of solid actors (vehicles, cops, parked rides, peds) — circle vs circle
function resolveActors(p,r){
  let imp=0;
  const push=(ox,oz,rr)=>{
    let dx=p.x-ox,dz=p.z-oz,d=Math.hypot(dx,dz);
    if(d>=rr)return;
    if(d<1e-4){dx=1;dz=0;d=0;}else{dx/=d;dz/=d;}
    p.x+=dx*(rr-d);p.z+=dz*(rr-d);
    const vn=p.vx*dx+p.vz*dz;
    if(vn<0){p.vx-=vn*dx;p.vz-=vn*dz;imp=Math.max(imp,-vn);}
  };
  for(const a of aiCars)if(!a.mesh.userData.dead)push(a.mesh.position.x,a.mesh.position.z,r+a.mesh.userData.rad*.82);
  for(const c of cops)if(!c.mesh.userData.dead)push(c.mesh.position.x,c.mesh.position.z,r+1.55);
  for(const v of parked)push(v.position.x,v.position.z,r+v.userData.rad*.82);
  for(const q of peds)if(q.state!=='down')push(q.x,q.z,r+.42);
  return imp;
}

// ---------- particles ----------
const parts=[];
const partGeo=new THREE.SphereGeometry(1,6,5);
function spawnP(x,y,z,color,size,life,vx,vy,vz){
  if(parts.length>140)return;
  const m=new THREE.Mesh(partGeo,new THREE.MeshBasicMaterial({color,transparent:true}));
  m.position.set(x,y,z);m.scale.setScalar(size);
  parts.push({m,vx,vy,vz,life,max:life});scene.add(m);
}
function sparks(p){for(let i=0;i<5;i++)spawnP(p.x,1,p.z,0xffd23e,.15,.4,rnd(-.3,.3),rnd(.1,.4),rnd(-.3,.3));}
function spawnBlood(p){for(let i=0;i<6;i++)spawnP(p.x,.4,p.z,0x991111,.2,.8,rnd(-.15,.15),rnd(.05,.25),rnd(-.15,.15));}
function explode(p){
  for(let i=0;i<22;i++)spawnP(p.x,1.5,p.z,pick([0xff6a00,0xffae00,0x333333,0xff2200]),rnd(.5,1.6),rnd(.8,1.6),rnd(-.5,.5),rnd(.2,.8),rnd(-.5,.5));
  const l=new THREE.PointLight(0xff8800,6,60);l.position.set(p.x,4,p.z);scene.add(l);
  setTimeout(()=>scene.remove(l),350);crashSound(1);
}

// ---------- mission ----------
let mission=null,markerMesh=null;
(function(){
  markerMesh=new THREE.Group();
  const ring=new THREE.Mesh(new THREE.CylinderGeometry(4,4,.8,24,1,true),
    new THREE.MeshBasicMaterial({color:0xffd23e,transparent:true,opacity:.65,side:THREE.DoubleSide}));
  ring.position.y=.6;
  const beam=new THREE.Mesh(new THREE.CylinderGeometry(1.1,1.1,70,12,1,true),
    new THREE.MeshBasicMaterial({color:0xffd23e,transparent:true,opacity:.18,side:THREE.DoubleSide}));
  beam.position.y=35;
  markerMesh.add(ring,beam);scene.add(markerMesh);
})();
function newMission(){
  let it,tries=0;
  do{it=pick(inters);tries++;}
  while(tries<30&&Math.hypot(it.x-player.x,it.z-player.z)<150);
  mission={x:it.x,z:it.z,pay:Math.round(rnd(300,700)/10)*10};
  markerMesh.position.set(it.x,0,it.z);markerMesh.visible=true;
  showMsg('DELIVERY — reach the yellow marker');
}
function showMsg(t){
  const el=document.getElementById('msg');el.textContent=t;el.style.opacity=1;
  clearTimeout(el._t);el._t=setTimeout(()=>el.style.opacity=0,3200);
}

// ---------- death / arrest ----------
function damageVehicle(n){
  if(!vehicle||vehicle.userData.dead)return;
  vehicle.userData.hp-=n;hitFlash(Math.min(.7,n/40));
  if(vehicle.userData.hp<=0){
    vehicle.userData.dead=true;vehicle.userData.hp=0;
    explode(vehicle.position);
    if(char.parent&&char.parent!==scene){scene.add(char);char.visible=false;} // rescue the rider so it isn't charred black
    vehicle.traverse(o=>{if(o.material&&o.material.color&&!o.material.emissiveMap)o.material=new THREE.MeshPhongMaterial({color:0x141414});});
    if(player.inCar)wastedNow();
  }
}
function respawn(){
  dead=false;playerHp=100;
  player.x=spawnX+5;player.z=spawnZ-4;player.vx=player.vz=0;player.heading=Math.PI/2;
  player.inCar=false;vehicle=null;
  scene.add(char);char.visible=true;char.scale.setScalar(1);pose(char,false);
  char.position.set(player.x,0,player.z);char.rotation.set(0,player.heading,0);
  wanted=0;updateStars();clearCops();
}
function wastedNow(){
  if(dead)return;dead=true;
  document.getElementById('wasted').style.display='flex';
  setTimeout(()=>{
    document.getElementById('wasted').style.display='none';
    money=Math.max(0,money-100);respawn();
    showMsg('Patched up at the hospital  (-$100)');
  },2800);
}
function bustedNow(){
  if(dead)return;dead=true;
  document.getElementById('busted').style.display='flex';
  setTimeout(()=>{
    document.getElementById('busted').style.display='none';
    money=Math.max(0,money-200);
    for(const w of owned)if(w!=='fist')ammo[w]=Math.floor((ammo[w]||0)/2);
    weaponHUD();respawn();
    showMsg('Released from the station  (-$200, half your ammo)');
  },2800);
}

// ---------- enter / exit / steal ----------
function mountChar(v){
  if(v.userData.type==='bike'){
    v.userData.lean.add(char);
    char.position.set(0,.5,-.3);char.rotation.set(0,0,0);char.scale.setScalar(1);
    pose(char,true);char.visible=true;
  }else{ // visible through the glass cabin
    v.add(char);
    char.position.set(-.45,.18,-.2);char.rotation.set(0,0,0);char.scale.setScalar(.85);
    pose(char,true);char.visible=true;
  }
}
function dismountChar(){
  scene.add(char);char.visible=true;char.scale.setScalar(1);pose(char,false);
  char.position.set(player.x,0,player.z);char.rotation.set(0,player.heading,0);
}
// door swing animation queue
const doors=[];
function openDoor(veh,closeAt){
  if(!veh.userData.door)return;
  doors.push({veh,target:1.15,closeAt});
}
// carjack sequence: walk to the door → open it → pull the driver out → slide in
let jack=null;
function startJack(near){
  const ai=aiCars.find(a=>a.mesh===near)||null;
  if(ai)ai.jacked=true;
  jack={veh:near,ai,phase:'walk',t:0};
}
function finishJack(){
  const near=jack.veh,ai=jack.ai;
  if(ai){
    const i=aiCars.indexOf(ai);if(i>=0)aiCars.splice(i,1);
    showMsg('GRAND THEFT AUTO!');
    if(policeNear(70))addWanted(1);   // only earns a star if the cops witness it
    spawnAI(near.userData.type==='bike');
  }
  const pIdx=parked.indexOf(near);if(pIdx>=0)parked.splice(pIdx,1);
  vehicle=near;player.inCar=true;
  player.x=near.position.x;player.z=near.position.z;
  player.heading=near.rotation.y;player.vx=player.vz=0;
  mountChar(near);exitCool=.6;jack=null;
}
function jackUpdate(dt,dtF){
  const v=jack.veh,bike=v.userData.type==='bike';
  const dp=v.localToWorld(new THREE.Vector3(bike?-1.0:-1.8,0,bike?.1:.9));
  if(jack.phase==='walk'){
    const dx=dp.x-player.x,dz=dp.z-player.z,d=Math.hypot(dx,dz);
    if(d>12){if(jack.ai)jack.ai.jacked=false;jack=null;return;}
    const ang=Math.atan2(dx,dz);
    player.heading=ang;
    player.x+=Math.sin(ang)*Math.min(.17*dtF,d);player.z+=Math.cos(ang)*Math.min(.17*dtF,d);
    char.position.set(player.x,0,player.z);char.rotation.y=ang;
    jack.t+=dt*10;
    const s=Math.sin(jack.t*6),L=char.userData.limbs;
    L[0].rotation.x=s*.7;L[1].rotation.x=-s*.7;L[2].rotation.x=-s*.6;L[3].rotation.x=s*.6;
    if(d<.5){
      jack.phase=bike?'pull':'open';jack.t=0;
      char.rotation.y=v.rotation.y; // face along the car
      if(!bike)openDoor(v,perf+1.4);
    }
    return;
  }
  jack.t+=dt;
  if(jack.phase==='open'){
    if(jack.t>.38){jack.phase=(jack.ai&&jack.ai.occupant)?'pull':'in';jack.t=0;}
  }else if(jack.phase==='pull'){
    if(jack.ai&&jack.ai.occupant){
      const occ=jack.ai.occupant;jack.ai.occupant=null;
      if(occ.parent)occ.parent.remove(occ);
      const ox=dp.x-v.position.x,oz=dp.z-v.position.z,od=Math.hypot(ox,oz)||1;
      thrownPed(dp.x+ox/od*1.4,dp.z+oz/od*1.4);
      crashSound(.35);
    }
    if(jack.t>.3){jack.phase='in';jack.t=0;}
  }else if(jack.phase==='in'){
    char.position.x+=(v.position.x-char.position.x)*.3*dtF;
    char.position.z+=(v.position.z-char.position.z)*.3*dtF;
    if(jack.t>.3)finishJack();
  }
}
function nearestEnterable(){
  let best=null,bd=4.5;
  const cand=parked.slice();
  for(const a of aiCars)cand.push(a.mesh);
  for(const m of cand){
    if(m.userData.dead)continue;
    const d=Math.hypot(m.position.x-player.x,m.position.z-player.z);
    if(d<bd){bd=d;best=m;}
  }
  return best;
}
function handleEnterExit(dtF){
  exitCool=Math.max(0,exitCool-dtF/60);
  const prompt=document.getElementById('prompt');
  if(player.inCar){
    if(Math.hypot(player.vx,player.vz)<.15){prompt.innerHTML='Press <b>E</b> to get out';prompt.style.opacity=1;}
    else prompt.style.opacity=0;
    if(pressedE&&exitCool<=0&&Math.hypot(player.vx,player.vz)<.3){
      exitCool=.6;player.inCar=false;
      const fx=Math.sin(player.heading),fz=Math.cos(player.heading);
      const veh=vehicle;
      player.x=veh.position.x-fz*2.6;player.z=veh.position.z+fx*2.6;
      player.vx=player.vz=0;
      if(!parked.includes(veh))parked.push(veh);
      dismountChar();openDoor(veh,perf+.8);vehicle=null;
    }
  }else{
    const near=nearestEnterable();
    if(near){
      const what=near.userData.type==='bike'?'bike':near.userData.type==='auto'?'auto':'car';
      prompt.innerHTML='Press <b>E</b> to '+(parked.includes(near)?'ride this '+what:'<b>steal</b> this '+what);
      prompt.style.opacity=1;
    }else prompt.style.opacity=0;
    if(pressedE&&exitCool<=0&&near){exitCool=.6;startJack(near);}
  }
  pressedE=false;
}

// ---------- minimap ----------
const mm=document.getElementById('minimap').getContext('2d');
const ms=720/(WORLD*2);
function drawBlip(x,z,color,r){
  mm.fillStyle=color;mm.beginPath();
  mm.arc((x+WORLD)*ms,(z+WORLD)*ms,r/1.15,0,7);mm.fill();
}
let healCool=0,insideLM=null;
function checkLandmarks(dt){
  insideLM=null;
  const onFoot=!player.inCar;
  for(const Lm of landmarks){
    const inside=onFoot&&Math.abs(player.x-Lm.x)<Lm.hw-.3&&Math.abs(player.z-Lm.z)<Lm.hd-.3;
    if(inside)insideLM=Lm;
    Lm.roof.visible=!inside;Lm.roof.userData.para.visible=!inside;
    if(inside&&(Lm.type==='hospital'||Lm.type==='food')&&playerHp<100){
      playerHp=Math.min(100,playerHp+24*dt);
      healCool-=dt;if(healCool<=0){healCool=2.6;showMsg(Lm.type==='hospital'?'Patched up at the hospital':'Tasty! Feeling better');}
    }
  }
}
function drawMinimap(){
  mm.clearRect(0,0,190,190);
  mm.save();
  mm.beginPath();mm.arc(95,95,93,0,7);mm.clip();
  mm.fillStyle='#10141c';mm.fillRect(0,0,190,190);
  mm.translate(95,95);mm.rotate(player.heading-Math.PI);
  const zoom=1.15;mm.scale(zoom,zoom);
  mm.translate(-(player.x+WORLD)*ms,-(player.z+WORLD)*ms);
  mm.drawImage(mapCv,0,0);
  if(mission)drawBlip(mission.x,mission.z,'#ffd23e',6);
  for(const c of cops)drawBlip(c.mesh.position.x,c.mesh.position.z,'#ff3b30',5);
  for(const f of footCops)drawBlip(f.mesh.position.x,f.mesh.position.z,'#ff3b30',3.4);
  for(const g of pickups)drawBlip(g.position.x,g.position.z,'#2ecc71',3.6);
  for(const Lm of landmarks){mm.fillStyle=Lm.color;mm.fillRect((Lm.x+WORLD)*ms-3.2,(Lm.z+WORLD)*ms-3.2,6.4,6.4);}
  if(!player.inCar)for(const p of parked)drawBlip(p.position.x,p.position.z,'#3fa9f5',4);
  mm.restore();
  mm.fillStyle='#fff';mm.strokeStyle='#000';mm.lineWidth=2;
  mm.beginPath();mm.moveTo(95,87);mm.lineTo(101,101);mm.lineTo(95,97);mm.lineTo(89,101);mm.closePath();
  mm.fill();mm.stroke();
  mm.fillStyle='#9fc1ff';mm.font='bold 13px Arial';mm.textAlign='center';
  mm.fillText('N',95-80*Math.sin(player.heading),95+80*Math.cos(player.heading)+4);
}
let bigOpen=false;
function toggleMap(){
  bigOpen=!bigOpen;
  const d=document.getElementById('bigmap');
  d.style.display=bigOpen?'flex':'none';
  if(bigOpen){
    const cv=document.getElementById('bigmapc'),sz=Math.min(innerWidth,innerHeight)*.86;
    cv.width=cv.height=sz;const g=cv.getContext('2d');
    g.drawImage(mapCv,0,0,sz,sz);
    const k=sz/(WORLD*2);
    if(mission){g.fillStyle='#ffd23e';g.beginPath();g.arc((mission.x+WORLD)*k,(mission.z+WORLD)*k,8,0,7);g.fill();}
    g.fillStyle='#2ecc71';
    for(const p of pickups){g.beginPath();g.arc((p.position.x+WORLD)*k,(p.position.z+WORLD)*k,4,0,7);g.fill();}
    g.fillStyle='#fff';g.strokeStyle='#000';g.lineWidth=2;
    g.save();g.translate((player.x+WORLD)*k,(player.z+WORLD)*k);g.rotate(Math.PI-player.heading);
    g.beginPath();g.moveTo(0,-9);g.lineTo(6,7);g.lineTo(0,3);g.lineTo(-6,7);g.closePath();g.fill();g.stroke();g.restore();
  }
}

// ---------- zones ----------
function zoneName(){
  if(river&&Math.abs(player.x-river.cx)<river.half+9)return 'Yamuna Riverfront';
  for(const Lm of landmarks)if(Math.abs(player.x-Lm.x)<Lm.hw&&Math.abs(player.z-Lm.z)<Lm.hd)return Lm.name;
  for(const b of blocks)if(b.park&&player.x>b.x0-12&&player.x<b.x1+12&&player.z>b.z0-12&&player.z<b.z1+12)return 'Nehru Park';
  const d=Math.hypot(player.x-spawnX,player.z-spawnZ);
  return d<140?'Connaught Place':d<280?'Bazaar District':'City Outskirts';
}

// ---------- main loop ----------
const clock=new THREE.Clock();
let perf=0,frame=0,curZone='',fireT=0;
const skyDay=new THREE.Color(0x87ceeb),skyNight=new THREE.Color(0x0b1026),skySet=new THREE.Color(0xff8c5a);
const skyTopDay=new THREE.Color(0x2f6fb0),skyTopNight=new THREE.Color(0x04060d);
const skyCol=new THREE.Color(),skyTopCol=new THREE.Color(),_sunDir=new THREE.Vector3();
newMission();weaponHUD();

function animate(){
  requestAnimationFrame(animate);
  const dt=Math.min(clock.getDelta(),.05),dtF=dt*60;
  perf+=dt;frame++;
  if(!started||bigOpen){renderFrame();return;}
  const k=inp();
  lightT+=dt;tod=(tod+dt/480)%1;

  // --- player ---
  if(!dead){
    if(player.inCar&&vehicle){
      const bike=vehicle.userData.type==='bike';
      const fx=Math.sin(player.heading),fz=Math.cos(player.heading);
      let vf=player.vx*fx+player.vz*fz, vl=player.vx*fz-player.vz*fx;
      const boost=k.boost&&vf>.1;
      if(k.up)vf+=(boost?(bike?.032:.026):(bike?.017:.014))*dtF;
      if(k.dn)vf-=(vf>.05?.035:.013)*dtF;
      vf*=Math.pow(.992,dtF);
      if(!k.up&&!k.dn)vf*=Math.pow(.985,dtF);
      vf=M.clamp(vf,-.4,boost?(bike?1.5:1.35):(bike?1.15:1.0));
      const steerIn=(k.lf?1:0)-(k.rt?1:0);
      player.steer+=(steerIn-player.steer)*.25*dtF;
      const grip=k.hb?.965:.82;
      player.heading+=player.steer*(k.hb?.055:(bike?.048:.038))*Math.sign(vf)*Math.min(1,Math.abs(vf)/.5)*dtF;
      if(k.hb)vf*=Math.pow(.985,dtF);
      vl*=Math.pow(grip,dtF);
      const nfx=Math.sin(player.heading),nfz=Math.cos(player.heading);
      player.vx=nfx*vf+nfz*vl;player.vz=nfz*vf-nfx*vl;
      const rad=vehicle.userData.rad;
      const pp={x:vehicle.position.x+player.vx*dtF,z:vehicle.position.z+player.vz*dtF,vx:player.vx,vz:player.vz};
      const imp=resolveCircle(pp,rad);
      player.vx=pp.vx;player.vz=pp.vz;
      pp.x=M.clamp(pp.x,-WORLD+4,WORLD-4);pp.z=M.clamp(pp.z,-WORLD+4,WORLD-4);
      vehicle.position.set(pp.x,0,pp.z);
      vehicle.rotation.y=player.heading;
      player.x=pp.x;player.z=pp.z;
      if(imp>.15){damageVehicle(imp*26);crashSound(imp);sparks(vehicle.position);}
      if(bike){
        vehicle.userData.lean.rotation.z=M.lerp(vehicle.userData.lean.rotation.z,-player.steer*Math.min(1,Math.abs(vf))*.45,.15);
      }else{
        vehicle.children[0].rotation.z=M.lerp(vehicle.children[0].rotation.z,-player.steer*Math.abs(vf)*.12,.2);
        vehicle.children[0].rotation.x=M.lerp(vehicle.children[0].rotation.x,(k.up?-.025:k.dn?.03:0),.15);
      }
      vehicle.userData.wheels.forEach((w,i)=>{w.rotation.x+=vf*.7*dtF;if(!bike&&i<2)w.rotation.y=player.steer*.42;});
      if(boost&&frame%3===0)spawnP(pp.x-nfx*2.6,.5,pp.z-nfz*2.6,0x66bbff,.3,.3,rnd(-.05,.05),.05,rnd(-.05,.05));
      if(vehicle.userData.hp<40&&frame%6===0)spawnP(pp.x+nfx*2,1.3,pp.z+nfz*2,0x555555,.45,1,rnd(-.03,.03),.12,rnd(-.03,.03));
      if(frame%9===0&&Math.abs(vf)<.3&&!bike)spawnP(pp.x-nfx*2.7,.4,pp.z-nfz*2.7,0x888888,.14,.5,0,.04,0);
      // shunt traffic
      for(const a of aiCars){
        const rr=rad+a.mesh.userData.rad;
        const dx=pp.x-a.mesh.position.x,dz=pp.z-a.mesh.position.z,d=Math.hypot(dx,dz);
        if(d<rr){
          const nx=dx/(d||1),nz=dz/(d||1),rel=Math.hypot(player.vx,player.vz);
          vehicle.position.x+=nx*(rr-d)*.6;vehicle.position.z+=nz*(rr-d)*.6;
          a.mesh.position.x-=nx*(rr-d)*.4;a.mesh.position.z-=nz*(rr-d)*.4;
          player.vx*=.92;player.vz*=.92;
          if(rel>.4){damageVehicle(rel*9);crashSound(rel*.7);sparks(vehicle.position);
            if(crimeCool<=0){addWanted(1);crimeCool=4;}}
        }
      }
    }else if(!jack){
      // third-person: the mouse turns BOTH the camera and the body; WASD moves relative to the look direction
      const worldAim=player.heading+camYaw;
      const mfx=(k.up?1:0)-(k.dn?1:0), mst=(k.lf?1:0)-(k.rt?1:0), moving=!!(mfx||mst);
      const aw0=owned[curW], armed=aw0!=='fist';
      // body tracks the camera whenever you move or aim → the mouse steers the character, not just the camera
      if(moving||armed){
        let dh=worldAim-player.heading;while(dh>Math.PI)dh-=2*Math.PI;while(dh<-Math.PI)dh+=2*Math.PI;
        player.heading+=dh*Math.min(1,(armed?.5:.28)*dtF);
        camYaw=worldAim-player.heading;     // camera holds its world direction while the body rotates under it
      }
      let moveX=0,moveZ=0;
      if(moving){
        moveX=mfx*Math.sin(worldAim)+mst*Math.sin(worldAim+Math.PI/2);
        moveZ=mfx*Math.cos(worldAim)+mst*Math.cos(worldAim+Math.PI/2);
        const ml=Math.hypot(moveX,moveZ)||1;moveX/=ml;moveZ/=ml;
      }
      const sp=(k.boost?.3:.16);
      player.vx=moveX*sp;player.vz=moveZ*sp;
      const pp={x:player.x+player.vx*dtF,z:player.z+player.vz*dtF,vx:player.vx,vz:player.vz};
      resolveCircle(pp,.5);resolveActors(pp,.5);
      player.x=M.clamp(pp.x,-WORLD+2,WORLD-2);player.z=M.clamp(pp.z,-WORLD+2,WORLD-2);
      player.vx=pp.vx;player.vz=pp.vz;
      char.position.set(player.x,0,player.z);char.rotation.y=player.heading;
      const s=Math.sin(perf*(k.boost?16:10))*(moving?1:0),L=char.userData.limbs;
      L[0].rotation.x=s*.7;L[1].rotation.x=-s*.7;
      // hold the gun out and aim with the camera when armed
      const gm=char.userData.gunMount;
      if(armed){
        gm.visible=true;for(const kk in char.userData.guns)char.userData.guns[kk].visible=(kk===aw0);
        gm.rotation.y=camYaw;                       // two-handed aim grip points where the camera looks
        L[3].rotation.set(-1.5,0,-.13);L[2].rotation.set(-1.32,0,.2);
      }else{gm.visible=false;L[2].rotation.set(-s*.6,0,0);L[3].rotation.set(s*.6,0,0);}
      for(const a of aiCars){
        if(Math.hypot(a.mesh.position.x-player.x,a.mesh.position.z-player.z)<1.6&&a.cur>.3)wastedNow();
      }
      // gun pickups
      for(const g of pickups){
        if(Math.hypot(g.position.x-player.x,g.position.z-player.z)<2.2){
          giveWeapon(g.userData.kind);
          scene.remove(g);pickups.splice(pickups.indexOf(g),1);
          setTimeout(spawnPickup,30000);
          break;
        }
      }
    }
    if(jack){jackUpdate(dt,dtF);pressedE=false;}
    else handleEnterExit(dtF);
    // shooting
    fireT-=dt;
    const w=owned[curW];
    if((firing||keys.KeyF)&&!jack&&w!=='fist'&&fireT<=0&&(ammo[w]||0)>0){
      const spec=WEAPONS[w];fireT=spec.rate;ammo[w]--;weaponHUD();
      const aimAng=player.heading+camYaw;
      let ox,oy=1.3,oz;
      if(player.inCar){const fx=Math.sin(aimAng),fz=Math.cos(aimAng);ox=player.x+fx*2.8;oz=player.z+fz*2.8;}
      else{const gun=char.userData.guns[w];gun.updateWorldMatrix(true,false);
        const mz=gun.localToWorld(new THREE.Vector3(0,0,gun.userData.muzzle));ox=mz.x;oy=mz.y;oz=mz.z;}
      for(let i=0;i<spec.n;i++)shoot(ox,oy,oz,aimAng+rnd(-spec.spread,spec.spread),'player',spec.dmg);
      spawnP(ox+Math.sin(aimAng)*.3,oy,oz+Math.cos(aimAng)*.3,0xfff2a0,.32,.07,0,.02,0);
    }
    checkLandmarks(dt);
    // talk to nearby people
    if(!player.inCar){
      const tp=findNearestPed(4.5);
      if(tp&&!talkingPed){const prm=document.getElementById('prompt');prm.innerHTML='Press <b>T</b> to talk';prm.style.opacity=1;}
      if(talkReq&&tp){talkingPed=tp;tp.state='talk';tp.talkT=4.5;tp.line=pick(TALK);}
    }
    talkReq=false;
  }
  crimeCool=Math.max(0,crimeCool-dt);

  // --- bullets ---
  for(let i=bullets.length-1;i>=0;i--){
    const b=bullets[i];b.life-=dt;
    let hit=b.life<=0;
    for(let s=0;s<3&&!hit;s++){
      b.m.position.x+=b.vx;b.m.position.z+=b.vz;
      const bx=b.m.position.x,bz=b.m.position.z;
      if(Math.abs(bx)>WORLD||Math.abs(bz)>WORLD||pointInBuilding(bx,bz)){hit=true;break;}
      if(b.from==='player'){
        for(const p of peds)if(p.state!=='down'&&Math.hypot(p.x-bx,p.z-bz)<1.1){
          downPed(p);if(crimeCool<=0){addWanted(1);crimeCool=2;}hit=true;break;}
        if(hit)break;
        for(let fi=footCops.length-1;fi>=0;fi--){
          const f=footCops[fi];
          if(Math.hypot(f.mesh.position.x-bx,f.mesh.position.z-bz)<1.1){
            spawnBlood(f.mesh.position);scene.remove(f.mesh);footCops.splice(fi,1);
            addWanted(2);hit=true;break;}
        }
        if(hit)break;
        for(let ci=cops.length-1;ci>=0;ci--){
          const c=cops[ci];
          if(Math.hypot(c.mesh.position.x-bx,c.mesh.position.z-bz)<2.2){
            c.mesh.userData.hp-=b.dmg;sparks(c.mesh.position);hit=true;
            if(c.mesh.userData.hp<=0){explode(c.mesh.position);scene.remove(c.mesh);cops.splice(ci,1);addWanted(1);}
            break;}
        }
        if(hit)break;
        for(const a of aiCars)if(Math.hypot(a.mesh.position.x-bx,a.mesh.position.z-bz)<2){
          sparks(a.mesh.position);a.base=Math.min(.95,a.base+.4);hit=true;break;}
      }else{ // cop bullet
        if(Math.hypot(player.x-bx,player.z-bz)<(player.inCar?2:0.9)){
          hit=true;
          if(player.inCar)damageVehicle(5);
          else{playerHp-=9;hitFlash(.55);spawnBlood({x:player.x,z:player.z});if(playerHp<=0)wastedNow();}
        }
      }
    }
    if(hit){scene.remove(b.m);bullets.splice(i,1);}
  }
  // pickup spin
  for(const g of pickups){g.rotation.y+=dt*2;g.position.y=1.1+Math.sin(perf*2.5+g.position.x)*.15;}

  // --- wanted & police ---
  if(wanted>0){
    wantedTimer-=dt;
    if(wantedTimer<=0){wanted--;wantedTimer=22;updateStars();
      if(wanted===0){clearCops();showMsg('You lost the heat');}}
    while(cops.length<wanted&&cops.length<4)spawnCop();
  }
  for(const c of cops)copUpdate(c,dtF);
  for(let i=footCops.length-1;i>=0;i--)if(!footCopUpdate(footCops[i],dtF))footCops.splice(i,1);

  // --- world ---
  for(const a of aiCars)aiUpdate(a,dtF);
  for(const c of cows)cowUpdate(c,dtF);
  if(river&&river.water)river.water.material.opacity=.82+Math.sin(perf*1.6)*.06; // gentle shimmer
  for(const p of peds)pedUpdate(p,dtF);
  updateCrowd();
  const nsS=lightState('z');
  for(const t of tlights){
    t.R.material.color.setHex(nsS==='R'?0xff2020:0x440000);
    t.Y.material.color.setHex(nsS==='Y'?0xffee00:0x444400);
    t.G.material.color.setHex(nsS==='G'?0x20ff40:0x004400);
  }
  // door swings
  for(let i=doors.length-1;i>=0;i--){
    const d=doors[i],dr=d.veh.userData.door;
    if(!dr){doors.splice(i,1);continue;}
    if(d.closeAt&&perf>d.closeAt)d.target=0;
    dr.rotation.y+=(d.target-dr.rotation.y)*.18*dtF;
    if(d.target===0&&Math.abs(dr.rotation.y)<.03){dr.rotation.y=0;doors.splice(i,1);}
  }
  for(let i=parts.length-1;i>=0;i--){
    const p=parts[i];p.life-=dt;
    if(p.life<=0){scene.remove(p.m);p.m.material.dispose();parts.splice(i,1);continue;}
    p.m.position.x+=p.vx*dtF;p.m.position.y+=p.vy*dtF;p.m.position.z+=p.vz*dtF;
    p.vy-=.012*dtF;p.m.material.opacity=p.life/p.max;p.m.scale.multiplyScalar(Math.pow(1.02,dtF));
  }

  // --- mission ---
  if(mission&&!dead){
    markerMesh.rotation.y+=dt;
    markerMesh.children[0].position.y=.6+Math.sin(perf*3)*.25;
    if(Math.hypot(player.x-mission.x,player.z-mission.z)<6){
      money+=mission.pay;chime();showMsg('DELIVERY COMPLETE  +$'+mission.pay);
      newMission();
    }
  }

  // --- day/night (smooth) ---
  const el=Math.sin((tod-.25)*Math.PI*2);
  const dayF=M.smoothstep(el,-.18,.42);
  skyCol.copy(skyNight).lerp(skyDay,dayF);
  const sf=Math.max(0,.3-Math.abs(el))/.3*(el>-.1?1:0)*.55;
  skyCol.lerp(skySet,sf);
  scene.background=skyCol;scene.fog.color.copy(skyCol);
  if(sky){ // drive the dome gradient + sun disk from the same day/night state
    skyTopCol.copy(skyTopNight).lerp(skyTopDay,dayF).lerp(skySet,sf*.5);
    sky.material.uniforms.top.value.copy(skyTopCol);
    sky.material.uniforms.bot.value.copy(skyCol);
    _sunDir.set(sun.position.x-player.x,sun.position.y,sun.position.z-player.z).normalize();
    sky.material.uniforms.sunDir.value.copy(_sunDir);
    sky.material.uniforms.sunCol.value.setRGB(1,.92,.74).multiplyScalar(.45+dayF*.7);
    sky.position.set(player.x,0,player.z);
  }
  sun.intensity=Math.max(0,el)*1.15;
  hemi.intensity=.1+dayF*.34;     // env map now supplies ambient fill, so dial the hemisphere down
  const night=1-dayF;
  for(const m of bldMats)m.emissiveIntensity=night*.9;
  headMat.emissiveIntensity=night*1.4;
  lampHead.emissiveIntensity=night*1.6;
  stars.material.opacity=night*.9;
  stars.position.set(player.x,0,player.z);
  const beamOn=(player.inCar&&vehicle&&!vehicle.userData.dead)?night:0;
  hlights.forEach((s,i)=>{
    s.intensity=beamOn*1.8;
    if(vehicle&&beamOn>0){
      const o=vehicle.localToWorld(new THREE.Vector3(i?.7:-.7,.95,2.3));
      s.position.copy(o);
      s.target.position.set(o.x+Math.sin(player.heading)*30,0,o.z+Math.cos(player.heading)*30);
    }
  });
  sun.position.set(player.x+Math.cos((tod-.25)*Math.PI*2)*220,Math.max(el,.1)*260,player.z+120);
  sun.target.position.set(player.x,0,player.z);

  // --- camera (mouse-orbit, GTA-style) ---
  const spd=Math.hypot(player.vx,player.vz);
  // slowly swing back behind the player when driving and the mouse is idle
  if(player.inCar&&spd>.25&&perf-lastMouse>1.5){
    let dy=-camYaw;while(dy>Math.PI)dy-=2*Math.PI;while(dy<-Math.PI)dy+=2*Math.PI;
    camYaw+=dy*Math.min(1,.025*dtF);
  }
  const camA=player.heading+camYaw;
  const cfx=Math.sin(camA),cfz=Math.cos(camA);
  const ch=Math.cos(camPitch),cv=Math.sin(camPitch);
  let dist,baseH,ly;
  if(player.inCar&&vehicle){dist=10+spd*4;baseH=3.4;ly=2;}
  else{dist=6.5;baseH=2.6;ly=1.6;}
  if(insideLM&&!player.inCar){dist=4.2;baseH=4.6;ly=1.4;}   // tuck the camera in under the open roof
  const cx=player.x-cfx*dist*ch, cz=player.z-cfz*dist*ch, cy=baseH+dist*cv+(player.inCar?spd*1.4:0);
  camera.position.x=M.lerp(camera.position.x,cx,.12*dtF);
  camera.position.y=M.lerp(camera.position.y,cy,.12*dtF);
  camera.position.z=M.lerp(camera.position.z,cz,.12*dtF);
  if(player.inCar&&spd>.6){ // speed rumble
    camera.position.y+=(Math.random()-.5)*spd*.05;
    camera.position.x+=(Math.random()-.5)*spd*.04;
  }
  camera.lookAt(player.x+cfx*2,ly,player.z+cfz*2);
  const tFov=70+(player.inCar?spd*8:0);
  if(Math.abs(camera.fov-tFov)>.3){camera.fov=M.lerp(camera.fov,tFov,.08);camera.updateProjectionMatrix();}

  // --- audio ---
  if(actx&&eng.g){
    if(actx.state==='suspended')actx.resume();
    const inCar=player.inCar&&vehicle&&!vehicle.userData.dead;
    eng.g.gain.value=inCar?.045:0;
    eng.o.frequency.value=65+spd*170+(k.up?18:0);
    skidGain.gain.value=(inCar&&k.hb&&spd>.35)?.12:0;
    eng.hornG.gain.value=(inCar&&k.horn)?.12:0;
    const pd=nearestPoliceDist();   // siren swells as the nearest unit closes in
    if(pd<150){
      eng.sirenG.gain.value=.025+.075*(1-pd/150);
      eng.siren.frequency.value=Math.sin(perf*7)>0?660:880;
    }else eng.sirenG.gain.value=0;
  }

  // --- speech bubble follows the person you're talking to ---
  {
    const bub=document.getElementById('bubble');
    if(talkingPed&&talkingPed.state==='talk'){
      _pos.set(talkingPed.x,2.2,talkingPed.z).project(camera);
      if(_pos.z<1){bub.textContent=talkingPed.line;bub.style.display='block';
        bub.style.left=((_pos.x*.5+.5)*innerWidth)+'px';bub.style.top=((-_pos.y*.5+.5)*innerHeight)+'px';}
      else bub.style.display='none';
    }else if(bub.style.display!=='none')bub.style.display='none';
  }

  // --- HUD ---
  if(frame%3===0){
    document.getElementById('speedo').innerHTML=Math.round(spd*(player.inCar?170:30))+' <small>km/h</small>';
    const hp=player.inCar&&vehicle?vehicle.userData.hp:playerHp;
    const bar=document.getElementById('hp');
    bar.style.width=Math.max(0,hp)+'%';
    bar.style.background=hp>50?'#3fa9f5':hp>25?'#f5a93f':'#e74c3c';
    document.getElementById('money').textContent='$'+money;
    const hrs=Math.floor(tod*24),min=Math.floor((tod*24%1)*60);
    document.getElementById('clock').textContent=String(hrs).padStart(2,'0')+':'+String(min).padStart(2,'0');
    document.getElementById('obj').textContent=mission?'DELIVERY · '+Math.round(Math.hypot(player.x-mission.x,player.z-mission.z))+'m':'';
    drawMinimap();
  }
  if(vigO>.012){document.getElementById('vig').style.opacity=vigO;vigO*=Math.pow(.92,dtF);}
  else if(vigO!==0){vigO=0;document.getElementById('vig').style.opacity=0;}
  if(frame%30===0){
    const z=zoneName();
    if(z!==curZone){curZone=z;document.getElementById('zone').textContent=z;}
  }
  renderFrame();
}
camera.position.set(player.x,5,player.z-10);
animate();

addEventListener('resize',()=>{
  camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();
  renderer.setSize(innerWidth,innerHeight);
  if(composer)composer.setSize(innerWidth,innerHeight);
  if(bloomPass)bloomPass.setSize(innerWidth,innerHeight);
});
}
