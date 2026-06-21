// Gully Run — ESM entry (asset-pipeline refactor scaffold).
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { AssetManager } from './core/assets.js';
import { WORLD, ROAD_W, SIDE, HALF, LANE } from './core/constants.js';
import { M, rnd, pick } from './core/math.js';
import { buildRoadNetwork } from './world/roads.js';
import { loadSettings, saveSettings, SETTINGS_DEFAULTS } from './core/settings.js';
import { hasSave, loadProgress, saveProgress } from './core/save.js';

function showError(m){document.getElementById('err').style.display='flex';document.getElementById('errmsg').textContent=m;}
try{main();}catch(e){showError(e.message+'\n'+(e.stack||''));}

function main(){
'use strict';

// world constants (core/constants.js), math helpers (core/math.js) and the
// road network (world/roads.js) are now imported at module top.
const { cityX, cityZ, midX, midZ, inters, spawnX, spawnZ } = buildRoadNetwork();
const DEBUG=location.hostname==='localhost'||location.hostname==='127.0.0.1'||location.search.includes('debug');
let saveSig='';   // last persisted progression signature — only write when it actually changes (debounce can't flush if called every frame)

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
if(DEBUG)window.__probe=()=>{const st={parked:parked.length,ai:aiCars.length};
  const car=parked.find(v=>v.userData.type==='car')||(aiCars[0]&&aiCars[0].mesh);
  if(car){const bb=new THREE.Box3().setFromObject(car);st.carY=car.position.y;st.minY=+bb.min.y.toFixed(3);st.maxY=+bb.max.y.toFixed(3);st.wheels=car.userData.wheels.length;}
  try{st.dynProps=dynProps.length;st.aliveProps=dynProps.filter(p=>!p.dead).length;st.ramps=ramps.length;st.decks=decks.length;
    st.flowDir=river?river.flow:0;st.deckH=decks[0]?decks[0].h:0;st.playerY=+player.y.toFixed(2);st.airborne=player.airborne;
    st.ghAtDeck=decks[0]?+groundHeightAt((decks[0].x0+decks[0].x1)/2,(decks[0].z0+decks[0].z1)/2).toFixed(2):0;
    st.peds=peds.length;st.gangs=gangs.length;st.aggro=gangs.filter(g=>g.state==='aggro').length;
    st.vigilActive=vigil.active;st.vigilKills=vigil.kills;st.vigilGoal=vigil.goal;
    st.fleeing=peds.filter(p=>p.state==='flee').length;
    st.wounded=peds.filter(p=>p.wounded).length;st.decapped=peds.filter(p=>p.decap).length;st.flyHeads=flyHeads.length;
    st.footY=+player.y.toFixed(2);st.airborne=player.airborne;st.knives=pickups.filter(g=>g.userData.kind==='knife').length;
    st.owned=owned.slice();st.patrols=aiCars.filter(a=>a.police).length;st.copWalkers=copWalkers.length;
    st.wanted=wanted;st.parkedPolice=parked.filter(v=>v.userData&&v.userData.beacons).length;
    st.taxiActive=taxi.active;st.taxiPhase=taxi.phase;st.taxiRoute=taxi.route?taxi.route.length:0;st.taxiTraveled=+taxi.traveled.toFixed(1);st.paidFare=taxi.paidFare;
    st.parkedTaxi=parked.filter(v=>v.userData&&v.userData.taxi).length;st.money=money;
    const plane=parked.find(v=>v.userData.type==='plane');st.planes=parked.filter(v=>v.userData.type==='plane').length;
    if(plane){const pb=new THREE.Box3().setFromObject(plane);st.planeMinY=+pb.min.y.toFixed(3);st.planeY=+plane.position.y.toFixed(2);}
    const heli=parked.find(v=>v.userData.type==='heli');if(heli){st.heliX=+heli.position.x.toFixed(0);st.heliZ=+heli.position.z.toFixed(0);}
    st.airportCx=airport?+airport.cx.toFixed(0):null;st.airportCz=airport?+airport.cz.toFixed(0):null;
    st.raceCx=race?+race.cx.toFixed(0):null;st.raceCz=race?+race.cz.toFixed(0):null;st.raceWp=race&&race.wp?race.wp.length:0;
    st.raceActive=race.active;st.raceLap=race.lap||0;st.racePos=race.pos||0;st.racers=racers.length;
    st.fps=+fpsEMA.toFixed(1);
    st.courierActive=courier.active;st.courierDrops=courier.drops;st.courierTime=+courier.time.toFixed(1);
    st.inCar=player.inCar;st.vehType=vehicle?vehicle.userData.type:null;st.inPlane=player.inCar&&vehicle&&vehicle.userData.type==='plane';
    st.charInScene=char.parent===scene;st.charVis=char.visible;st.jack=jack?jack.phase:null;st.jackT=jack?+jack.t.toFixed(2):null;st.exitCool=+exitCool.toFixed(2);
    if(river){st.riverX0=+river.x0.toFixed(0);st.riverX1=+river.x1.toFixed(0);}
    st.settings={volume:settings.volume,sensitivity:settings.sensitivity,invertY:settings.invertY,quality:settings.quality};st.hasSave=hasSave();st.paused=paused; // TEMP diag
    st.px=+player.x.toFixed(2);st.pz=+player.z.toFixed(2);st.vehHp=vehicle?+vehicle.userData.hp.toFixed(1):null;
    st.vehSpd=vehicle&&vehicle.userData.spd!=null?+vehicle.userData.spd.toFixed(2):null;st.vy=+player.vy.toFixed(2);
    const _wd=new THREE.Vector3();camera.getWorldDirection(_wd);st.camY=+camera.position.y.toFixed(2);st.camDirY=+_wd.y.toFixed(3);st.camPitch=+camPitch.toFixed(3);}catch(e){st.probeErr=e.message;}
  return st;}; // TEMP
if(DEBUG)window.__tp=(x,z)=>{player.x=x;player.z=z;if(!player.inCar){player.y=0;player.vy=0;}}; // TEMP test teleport
if(DEBUG)window.__cam=(p,y)=>{camPitch=p;if(y!==undefined)camYaw=y;}; // TEMP force camera pitch/yaw
if(DEBUG)window.__hdg=()=>+player.heading.toFixed(3); // TEMP
let assetsReady=false;
function markReady(){
  if(assetsReady)return;assetsReady=true;
  const n=document.getElementById('mNew');if(n)n.disabled=false;
  const c=document.getElementById('mContinue');if(c&&hasSave())c.disabled=false;
  const l=document.getElementById('loadlbl');if(l)l.style.display='none';
}
{const p=document.querySelector('#intro p');if(p)p.textContent='LOADING WORLD…';}
let booted=false;
function runBoot(){if(booted)return;booted=true;boot();markReady();}   // spawn vehicles once GLB models are in
const CARGLBS=['sedan','sedan-sports','hatchback-sports','suv','suv-luxury','taxi','van','race','police'];
const TREEGLBS=['tree_default','tree_detailed','tree_pineRoundA','tree_palmDetailedTall'];
Promise.all([
  assets.loadHDRI('./assets/hdri/sky_1k.hdr').then(env=>{scene.environment=env;}).catch(()=>{}),
  ...CARGLBS.map(id=>assets.loadGLTF(id,`./assets/models/cars/${id}.glb`).catch(()=>{})),
  ...TREEGLBS.map(id=>assets.loadGLTF(id,`./assets/models/nature/${id}.glb`).catch(()=>{}))
]).then(runBoot);
setTimeout(runBoot,10000);     // never hard-block if the CDN/assets are slow or offline
scene.fog=new THREE.Fog(0x87ceeb,100,820);   // pulled in slightly for stronger atmospheric depth (still linear: water shader reads fog.near/far)
// ---------- post-processing: bloom + cinematic colour grade (degrades gracefully if CDN modules miss) ----------
let composer=null,bloomPass=null,ssaoPass=null,smaaPass=null,lowGfx=false;
if(EffectComposer&&UnrealBloomPass&&RenderPass&&ShaderPass)try{
  composer=new EffectComposer(renderer);
  // SSAO renders the scene itself (beauty * ambient occlusion) → grounds objects with soft contact
  // shadows in crevices/under cars. Falls back to a plain RenderPass if the CDN module is missing.
  if(SSAOPass){
    const ssao=new SSAOPass(scene,camera,innerWidth,innerHeight);
    ssao.kernelRadius=8; ssao.minDistance=.0008; ssao.maxDistance=.12; ssao.output=SSAOPass.OUTPUT.Default;
    ssaoPass=ssao;
    composer.addPass(ssao);
  }else composer.addPass(new RenderPass(scene,camera));
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
  // SMAA last → restores crisp edges that `antialias:true` cannot provide once we render
  // through an offscreen composer target (MSAA on the canvas is bypassed by post-processing).
  if(SMAAPass){smaaPass=new SMAAPass(innerWidth,innerHeight);composer.addPass(smaaPass);}
  composer.setSize(innerWidth,innerHeight);
}catch(e){composer=null;}
function renderFrame(){(composer&&!lowGfx)?composer.render():renderer.render(scene,camera);}
const hemi=new THREE.HemisphereLight(0xbfd6ff,0x4a4034,.6);scene.add(hemi);
const sun=new THREE.DirectionalLight(0xfff2dd,1.1);
sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);
sun.shadow.radius=3.2;sun.shadow.bias=-0.00035;sun.shadow.normalBias=.5;   // soft, artifact-free contact shadows
// frustum follows the player (sun tracks player.x/z), so a tighter box packs more texels per unit → crisper shadows for free
const sc=sun.shadow.camera;sc.left=-110;sc.right=110;sc.top=110;sc.bottom=-110;sc.near=20;sc.far=600;
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
const treeSpots=[];   // positions collected at init; instanced from GLB trees in boot() (after load)
function addTree(x,z){treeSpots.push([x,z,rnd(.85,1.25)]);}
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
// reserve a clear building-free corridor (one block-row) for the elevated highway flyover,
// far from spawn, so the structure never clips buildings and ramps land on open ground.
const stuntZone={};
{
  let bj=-1,best=-1;
  for(let j=0;j<cityZ.length-1;j++){
    const cz=(cityZ[j].c+cityZ[j+1].c)/2,gap=cityZ[j+1].c-cityZ[j].c,far=Math.abs(cz-spawnZ);
    if(gap<30||far<100)continue;
    const score=gap+Math.min(far,260)*.5;
    if(score>best){best=score;bj=j;}
  }
  if(bj<0)bj=cityZ.length-2;
  const cz=(cityZ[bj].c+cityZ[bj+1].c)/2;
  const half=Math.min((cityZ[bj+1].c-cityZ[bj].c)/2,26);
  stuntZone.z=cz;stuntZone.x0=-WORLD+95;stuntZone.x1=WORLD-95;stuntZone.h=8;
  for(const b of blocks)if(!b.special&&!b.river&&Math.abs(b.cz-cz)<half&&b.cx>stuntZone.x0-50&&b.cx<stuntZone.x1+50){b.special=true;b.stunt=true;}
}
// ---------- airport: a flat reserved airfield (runway along x) in the corner furthest from spawn ----------
const airport={};
{
  airport.cx=(spawnX>0?-1:1)*(WORLD-185);
  airport.cz=(spawnZ>0?-1:1)*(WORLD-185);
  airport.hw=115;airport.hd=40;
  airport.x0=airport.cx-airport.hw;airport.x1=airport.cx+airport.hw;
  airport.z0=airport.cz-airport.hd;airport.z1=airport.cz+airport.hd;
  // keep every building out of the airfield (reserve overlapping blocks before the building loop runs)
  for(const b of blocks)if(!b.special&&!b.river&&b.x1>airport.x0-6&&b.x0<airport.x1+6&&b.z1>airport.z0-6&&b.z0<airport.z1+6){b.special=true;b.airport=true;}
  // apron + runway surface (thin slabs just above the ground texture)
  const apron=new THREE.Mesh(new THREE.BoxGeometry(airport.hw*2,.12,airport.hd*2),new THREE.MeshStandardMaterial({color:0x3a4048,roughness:.95,metalness:.04}));
  apron.position.set(airport.cx,.06,airport.cz);apron.receiveShadow=true;scene.add(apron);
  const runway=new THREE.Mesh(new THREE.BoxGeometry(airport.hw*2-14,.14,26),new THREE.MeshStandardMaterial({color:0x23272e,roughness:.98,metalness:.03}));
  runway.position.set(airport.cx,.1,airport.cz);runway.receiveShadow=true;scene.add(runway);
  const lineMat=new THREE.MeshStandardMaterial({color:0xf2f2f2,roughness:.7,emissive:0x222222});
  for(let x=-airport.hw+18;x<airport.hw-18;x+=14){const d=new THREE.Mesh(new THREE.BoxGeometry(7,.02,.8),lineMat);d.position.set(airport.cx+x,.18,airport.cz);scene.add(d);}
  for(const ex of [-airport.hw+10,airport.hw-10])for(let i=-3;i<=3;i++){const t=new THREE.Mesh(new THREE.BoxGeometry(3,.02,1.0),lineMat);t.position.set(airport.cx+ex,.18,airport.cz+i*2.2);scene.add(t);}
  // terminal/hangar on the +z edge (solid) with a curved roof, plus a control tower
  const tz=airport.cz+airport.hd-9,tw=70,td=14;
  const term=new THREE.Mesh(new THREE.BoxGeometry(tw,11,td),new THREE.MeshStandardMaterial({color:0x6b7480,roughness:.7,metalness:.2}));
  term.position.set(airport.cx,5.5,tz);term.castShadow=term.receiveShadow=true;scene.add(term);
  colliders.push({x0:airport.cx-tw/2,x1:airport.cx+tw/2,z0:tz-td/2,z1:tz+td/2});
  const roofA=new THREE.Mesh(new THREE.CylinderGeometry(8,8,tw,16,1,false,0,Math.PI),new THREE.MeshStandardMaterial({color:0x9aa3ad,roughness:.6,metalness:.3}));
  roofA.rotation.z=Math.PI/2;roofA.position.set(airport.cx,11,tz);roofA.castShadow=true;scene.add(roofA);
  const tx2=airport.cx-airport.hw+14;
  const tower=new THREE.Mesh(new THREE.BoxGeometry(6,20,6),new THREE.MeshStandardMaterial({color:0x8a929c,roughness:.7,metalness:.2}));
  tower.position.set(tx2,10,tz);tower.castShadow=true;scene.add(tower);
  colliders.push({x0:tx2-3,x1:tx2+3,z0:tz-3,z1:tz+3});
  const cab=new THREE.Mesh(new THREE.BoxGeometry(9,4,9),new THREE.MeshStandardMaterial({color:0x1a2230,roughness:.1,metalness:.6,transparent:true,opacity:.7}));
  cab.position.set(tx2,21,tz);scene.add(cab);
  const bcn=new THREE.PointLight(0xff4444,1.0,70);bcn.position.set(tx2,24,tz);scene.add(bcn);airport.beacon=bcn;
}

// ---------- F1-style race circuit (data + visuals + marker; race logic added separately) ----------
const race={cx:(river?(river.cx>0?-1:1):(spawnX>0?1:-1))*(WORLD-150),cz:(spawnZ>0?1:-1)*(WORLD-150),rx:72,rz:56,active:false,marker:null};   // sit the circuit on the bank OPPOSITE the river so the track never lands on water
race.x0=race.cx-92;race.x1=race.cx+92;race.z0=race.cz-78;race.z1=race.cz+78;
// reserve the circuit footprint so no buildings spawn on the track (same trick as the airport)
for(const b of blocks)if(!b.special&&!b.river&&b.x1>race.x0-6&&b.x0<race.x1+6&&b.z1>race.z0-6&&b.z0<race.z1+6){b.special=true;b.race=true;}
race.wp=[];for(let i=0;i<16;i++){const a=i/16*Math.PI*2;race.wp.push({x:race.cx+Math.cos(a)*race.rx,z:race.cz+Math.sin(a)*race.rz});}
{
  // grass infield
  const inf=new THREE.Mesh(new THREE.CircleGeometry(1,48),new THREE.MeshStandardMaterial({color:0x2f7d34,roughness:1}));
  inf.rotation.x=-Math.PI/2;inf.scale.set(race.rx-9,race.rz-9,1);inf.position.set(race.cx,.05,race.cz);inf.receiveShadow=true;scene.add(inf);
  // asphalt ribbon: one slab per segment of the loop
  const trackMat=new THREE.MeshStandardMaterial({color:0x23262b,roughness:.92,metalness:.05});
  for(let i=0;i<race.wp.length;i++){const a=race.wp[i],b2=race.wp[(i+1)%race.wp.length];
    const dx=b2.x-a.x,dz=b2.z-a.z,len=Math.hypot(dx,dz);
    const seg=new THREE.Mesh(new THREE.BoxGeometry(len+2.5,.12,14),trackMat);
    seg.position.set((a.x+b2.x)/2,.12,(a.z+b2.z)/2);seg.rotation.y=Math.atan2(-dz,dx);seg.receiveShadow=true;scene.add(seg);}
  // start/finish stripe at wp[0]
  const d0x=race.wp[1].x-race.wp[0].x,d0z=race.wp[1].z-race.wp[0].z;
  const sf=new THREE.Mesh(new THREE.BoxGeometry(2.2,.14,14),new THREE.MeshStandardMaterial({color:0xf2f2f2,roughness:.6}));
  sf.position.set(race.wp[0].x,.16,race.wp[0].z);sf.rotation.y=Math.atan2(-d0z,d0x);scene.add(sf);
  // drive-in start marker (red ring) — race logic hooks onto this next
  const rm=new THREE.Group();
  const rr=new THREE.Mesh(new THREE.TorusGeometry(2.4,.32,8,26),new THREE.MeshBasicMaterial({color:0xff2d2d}));rr.rotation.x=Math.PI/2;rr.position.y=.6;
  rm.add(rr);rm.position.set(race.wp[0].x,0,race.wp[0].z);scene.add(rm);race.marker=rm;
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
  river.flow=Math.random()<.5?1:-1;       // downstream direction along +z/-z
  river.flowSpeed=.045;
  // flowing-water shader: Gerstner-ish surface waves + scrolling foam streaks travelling downstream
  const waterMat=new THREE.ShaderMaterial({transparent:true,fog:true,
    uniforms:{uTime:{value:0},uFlow:{value:river.flow},
      fogColor:{value:scene.fog.color},fogNear:{value:scene.fog.near},fogFar:{value:scene.fog.far}},
    vertexShader:'uniform float uTime,uFlow;varying vec2 vUv;varying float vWave;varying float vFog;'
      +'void main(){vUv=uv;vec3 p=position;float t=uTime*uFlow;'
      +'float w=sin(uv.y*44.0-t*1.7)*0.13+sin(uv.y*19.0+uv.x*6.0-t*1.05)*0.08+sin(uv.x*24.0+t*0.6)*0.04;'
      +'p.z+=w;vWave=w;'                                   // local z -> world y (plane is rotated flat)
      +'vec4 mv=modelViewMatrix*vec4(p,1.0);vFog=-mv.z;'
      +'gl_Position=projectionMatrix*mv;}',
    fragmentShader:'uniform float uTime,uFlow;uniform vec3 fogColor;uniform float fogNear,fogFar;'
      +'varying vec2 vUv;varying float vWave;varying float vFog;'
      +'void main(){float t=uTime*uFlow;'
      +'vec3 deep=vec3(0.04,0.20,0.32),shallow=vec3(0.12,0.43,0.56);'
      +'vec3 col=mix(deep,shallow,clamp(vWave*2.2+0.5,0.0,1.0));'
      +'float ripple=sin(vUv.y*130.0-t*5.2)*0.5+0.5;col+=vec3(0.18,0.24,0.30)*ripple*0.28;'
      +'float foam=smoothstep(0.80,0.98,sin(vUv.x*58.0)*0.5+0.5+sin(vUv.y*30.0-t*3.0)*0.3);'  // streaks scroll with the current
      +'col=mix(col,vec3(0.82,0.9,0.95),foam*0.4);'
      +'float f=smoothstep(fogNear,fogFar,vFog);col=mix(col,fogColor,f);'
      +'gl_FragColor=vec4(col,0.9);}'});
  const water=new THREE.Mesh(new THREE.PlaneGeometry(river.x1-river.x0,WORLD*2,20,96),waterMat);
  water.rotation.x=-Math.PI/2;water.position.set(river.cx,.06,0);water.receiveShadow=false;scene.add(water);
  river.water=water;river.waterMat=waterMat;
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
// is this point in the open river channel (not on a crossing bridge)?
function inRiver(x,z){
  if(!river||x<river.x0||x>river.x1)return false;
  for(const cz of river.cross)if(Math.abs(z-cz)<ROAD_W/2+3)return false;
  return true;
}
// ---------- elevated structures: highway flyover, stunt ramps (drivable height field) ----------
// supports: deck = flat raised slab; ramp = linear incline along +x. groundHeightAt(x,z) = max support, else 0.
const ramps=[],decks=[];
// height of the elevated surface at (x,z). maxReach (optional) = highest surface you can
// actually step onto from your current height — surfaces ABOVE that (a deck overhead) are
// ignored, so you drive UNDER a flyover instead of being teleported up onto it.
function groundHeightAt(x,z,maxReach){
  let h=0;
  for(const d of decks)if(x>=d.x0&&x<=d.x1&&z>=d.z0&&z<=d.z1){if(maxReach===undefined||d.h<=maxReach)h=Math.max(h,d.h);}
  for(const r of ramps)if(x>=r.x0&&x<=r.x1&&z>=r.z0&&z<=r.z1){
    const t=M.clamp((x-r.x0)/(r.x1-r.x0),0,1),rh=r.h0+(r.h1-r.h0)*t;
    if(maxReach===undefined||rh<=maxReach)h=Math.max(h,rh);
  }
  return h;
}
// triangular-prism ramp geometry: low edge at local x=0, rises to H at x=Lx (or reversed)
function makeWedge(Lx,Wz,H,highAtMaxX){
  const w=Wz/2,y0=highAtMaxX?0:H,y1=highAtMaxX?H:0;
  const v=new Float32Array([
    0,y0,-w, Lx,y1,-w, Lx,0,-w,   0,0,-w, 0,y0,-w, Lx,0,-w,   // side z-
    0,y0, w, Lx,0, w, Lx,y1, w,   0,0, w, Lx,0, w, 0,y0, w,   // side z+
    0,y0,-w, 0,y0, w, Lx,y1, w,   0,y0,-w, Lx,y1, w, Lx,y1,-w, // sloped top
    0,0,-w, Lx,0,-w, Lx,0, w,     0,0,-w, Lx,0, w, 0,0, w,     // bottom
    Lx,0,-w, Lx,y1,-w, Lx,y1, w,  Lx,0,-w, Lx,y1, w, Lx,0, w   // back wall (vertical face at max x)
  ]);
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(v,3));g.computeVertexNormals();return g;
}
const roadMat3=new THREE.MeshStandardMaterial({color:0x44474d,roughness:.92,metalness:.05,envMapIntensity:.2});
const pillarMat=new THREE.MeshStandardMaterial({color:0x6b6f76,roughness:.85,metalness:.1});
const rampMat=new THREE.MeshStandardMaterial({color:0x3c5a6b,roughness:.7,metalness:.2,envMapIntensity:.4});
const railMat3=new THREE.MeshStandardMaterial({color:0xc9ccd1,roughness:.5,metalness:.4});
// build a flyover that runs along +x: up-ramp, flat deck (with rails + pillars), down-ramp
function buildFlyover(cx,cz,len,wid,H,rampLen){
  const x0=cx-len/2,x1=cx+len/2,z0=cz-wid/2,z1=cz+wid/2;
  decks.push({x0,x1,z0,z1,h:H});
  const deck=new THREE.Mesh(new THREE.BoxGeometry(len,.5,wid),roadMat3);deck.position.set(cx,H-.25,cz);deck.castShadow=deck.receiveShadow=true;scene.add(deck);
  // up-ramp (rises toward +x into x0) and down-ramp (descends from x1)
  const up=new THREE.Mesh(makeWedge(rampLen,wid,H,true),rampMat);up.position.set(x0-rampLen,0,cz);up.castShadow=up.receiveShadow=true;scene.add(up);
  ramps.push({x0:x0-rampLen,x1:x0,z0,z1,h0:0,h1:H});
  const dn=new THREE.Mesh(makeWedge(rampLen,wid,H,false),rampMat);dn.position.set(x1,0,cz);dn.castShadow=dn.receiveShadow=true;scene.add(dn);
  ramps.push({x0:x1,x1:x1+rampLen,z0,z1,h0:H,h1:0});
  // side rails (visual) + support pillars marching under the deck
  for(const sz of [z0+.4,z1-.4]){const rail=new THREE.Mesh(new THREE.BoxGeometry(len,1.0,.25),railMat3);rail.position.set(cx,H+.5,sz);rail.castShadow=true;scene.add(rail);}
  for(let px=x0+6;px<x1;px+=22)for(const sz of [z0+1.2,z1-1.2]){
    const pil=new THREE.Mesh(new THREE.CylinderGeometry(.9,1.1,H,8),pillarMat);pil.position.set(px,H/2,sz);pil.castShadow=true;scene.add(pil);}
  return {cx,cz};
}
// a lone stunt ramp (kicker) that launches you off its high +x lip
function buildStuntRamp(cx,cz,len,wid,H,faceMaxX){
  const x0=cx-len/2,x1=cx+len/2,z0=cz-wid/2,z1=cz+wid/2;
  const w=new THREE.Mesh(makeWedge(len,wid,H,faceMaxX),rampMat);w.position.set(x0,0,cz);w.castShadow=w.receiveShadow=true;scene.add(w);
  ramps.push({x0,x1,z0,z1,h0:faceMaxX?0:H,h1:faceMaxX?H:0});
}
// elevated highway flyover down the reserved (building-free) corridor; ramps land on open ground
buildFlyover((stuntZone.x0+stuntZone.x1)/2, stuntZone.z, stuntZone.x1-stuntZone.x0, 16, stuntZone.h, 34);
// stunt kickers placed inside parks (grass, never on roads or in buildings)
{
  const parks=blocks.filter(b=>b.park&&!b.special&&(b.x1-b.x0)>22&&(b.z1-b.z0)>16)
    .sort((a,b)=>Math.hypot(b.cx-spawnX,b.cz-spawnZ)-Math.hypot(a.cx-spawnX,a.cz-spawnZ));
  let n=0;
  for(const b of parks){if(n>=3)break;
    const len=Math.min(15,(b.x1-b.x0)-6);
    buildStuntRamp(b.cx,b.cz,len,9,rnd(2.6,3.4),Math.random()<.5);n++;}
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
// forest belt in the outskirts — positions collected, instanced from GLB trees in boot()
for(let i=0;i<240;i++){
  const a=rnd(0,Math.PI*2), rad=rnd(WORLD-18,515);
  treeSpots.push([Math.cos(a)*rad, Math.sin(a)*rad, rnd(.8,1.55)]);
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

// ---------- dynamic destructible props (mass + rigid-body knock physics) ----------
const dynProps=[];
const crateMat=new THREE.MeshStandardMaterial({color:0x9c6b3f,roughness:.85,metalness:.05,envMapIntensity:.2});
const barrelMat=new THREE.MeshStandardMaterial({color:0xc0392b,roughness:.55,metalness:.35,envMapIntensity:.45});
const coneMat=new THREE.MeshStandardMaterial({color:0xe8632a,roughness:.7,metalness:.05,emissive:0x3a1400,emissiveIntensity:.25});
function makeProp(kind,x,z){
  let mesh,rad,mass,restY,breakable=false;
  if(kind==='crate'){mesh=new THREE.Mesh(new THREE.BoxGeometry(.9,.9,.9),crateMat);rad=.6;mass=1.0;restY=.45;breakable=true;}
  else if(kind==='barrel'){mesh=new THREE.Mesh(new THREE.CylinderGeometry(.42,.42,1.0,12),barrelMat);rad=.5;mass=1.4;restY=.5;}
  else{mesh=new THREE.Mesh(new THREE.ConeGeometry(.32,.9,10),coneMat);rad=.33;mass=.4;restY=.45;}
  mesh.castShadow=true;mesh.position.set(x,restY,z);scene.add(mesh);
  const pr={mesh,kind,x,z,y:restY,vx:0,vy:0,vz:0,ax:0,az:0,rad,mass,restY,breakable,inWater:false,dead:false};
  dynProps.push(pr);return pr;
}
function knockProp(pr,nx,nz,force){
  if(pr.dead)return;
  const im=force/pr.mass;
  pr.vx+=nx*im;pr.vz+=nz*im;pr.vy+=Math.min(.2,im*.4);
  pr.ax+=rnd(-1,1)*im*.5;pr.az+=rnd(-1,1)*im*.5;
  if(pr.breakable&&force*im>3.2)breakProp(pr);
}
function breakProp(pr){
  if(pr.dead)return;pr.dead=true;scene.remove(pr.mesh);
  for(let i=0;i<10;i++)spawnP(pr.x,pr.y,pr.z,0x9c6b3f,rnd(.12,.26),rnd(.5,.9),rnd(-.25,.25),rnd(.1,.45),rnd(-.25,.25));
  crashSound(.45);
}
function dynUpdate(dtF){
  for(const pr of dynProps){
    if(pr.dead)continue;
    if(Math.abs(pr.vx)+Math.abs(pr.vz)+Math.abs(pr.vy)<.004&&pr.y<=pr.restY+.01&&!pr.inWater)continue; // sleeping
    pr.vy-=.02*dtF;                                   // gravity
    pr.x+=pr.vx*dtF;pr.z+=pr.vz*dtF;pr.y+=pr.vy*dtF;
    if(pr.inWater&&river){pr.x=M.clamp(pr.x,river.x0+.6,river.x1-.6);pr.vz+=river.flow*river.flowSpeed*.5*dtF;pr.vz=M.clamp(pr.vz,-.25,.25);}
    else{const c={x:pr.x,z:pr.z,vx:pr.vx,vz:pr.vz};resolveCircle(c,pr.rad);pr.x=c.x;pr.z=c.z;pr.vx=c.vx;pr.vz=c.vz;}
    if(pr.y<=pr.restY){pr.y=pr.restY;
      if(pr.vy<-.05){pr.vy*=-.3;}else pr.vy=0;
      pr.vx*=Math.pow(.85,dtF);pr.vz*=Math.pow(.85,dtF);pr.ax*=Math.pow(.8,dtF);pr.az*=Math.pow(.8,dtF);}
    pr.x=M.clamp(pr.x,-WORLD+2,WORLD-2);pr.z=M.clamp(pr.z,-WORLD+2,WORLD-2);
    pr.mesh.position.set(pr.x,pr.y,pr.z);
    pr.mesh.rotation.x+=pr.ax*dtF;pr.mesh.rotation.z+=pr.az*dtF;
  }
}

// scatter props along sidewalks + clusters in front of the stunt ramps for smash-throughs
for(let i=0;i<26;i++){const L=pick(cityX),z=rnd(L.a+15,L.b-15),side=Math.random()<.5?1:-1;
  makeProp(pick(['crate','barrel','cone','cone']),L.c+side*(HALF-.8),z);}
for(const[sx,sz]of[[spawnX+34,spawnZ+24],[spawnX-40,spawnZ-30]])
  for(let i=0;i<7;i++)makeProp(pick(['crate','crate','barrel']),sx+rnd(-3,3),sz+rnd(4,9));
if(river)for(let i=0;i<5;i++){const pr=makeProp('barrel',river.cx+rnd(-river.half+1,river.half-1),rnd(-WORLD+40,WORLD-40));pr.inWater=true;}

// ---------- vehicle factories ----------
const headMat=new THREE.MeshStandardMaterial({color:0xfffdf0,emissive:0xfff6cc,emissiveIntensity:0,roughness:.25,metalness:.1});
const tailMat=new THREE.MeshStandardMaterial({color:0x550000,emissive:0xff2200,emissiveIntensity:.4,roughness:.25,metalness:.1});
const wheelGeo=new THREE.CylinderGeometry(.45,.45,.42,14);wheelGeo.rotateZ(Math.PI/2);
const wheelMat=new THREE.MeshStandardMaterial({color:0x121212,roughness:.72,metalness:.22});
const CAR_MODELS=['sedan','sedan-sports','hatchback-sports','suv','suv-luxury','taxi','van','race'];
// GLB car (CC0 Kenney Car Kit) mapped onto the gameplay contract (wheels, beacons); falls back to procedural
// per-vehicle handling presets (accel, top speed, turn rate, grip range) → each class drives distinctly
const HANDLING={
  sedan:{accel:.014,top:1.0,turn:.038,gripLo:.80,gripHi:.93},
  taxi:{accel:.013,top:.96,turn:.037,gripLo:.80,gripHi:.92},
  race:{accel:.021,top:1.4,turn:.044,gripLo:.83,gripHi:.96},
  'sedan-sports':{accel:.018,top:1.2,turn:.042,gripLo:.82,gripHi:.95},
  'hatchback-sports':{accel:.018,top:1.15,turn:.046,gripLo:.81,gripHi:.94},
  suv:{accel:.012,top:.92,turn:.032,gripLo:.78,gripHi:.90},
  'suv-luxury':{accel:.013,top:.98,turn:.033,gripLo:.79,gripHi:.91},
  van:{accel:.0105,top:.82,turn:.029,gripLo:.76,gripHi:.88},
  police:{accel:.018,top:1.18,turn:.043,gripLo:.83,gripHi:.94},
  bike:{accel:.017,top:1.15,turn:.048,gripLo:.80,gripHi:.93},
  auto:{accel:.011,top:.72,turn:.05,gripLo:.78,gripHi:.90}
};
function makeCar(color,cop,forceModel){
  const id=cop?'police':(forceModel||pick(CAR_MODELS));
  const model=assets.spawn(id);
  if(!model)return makeCarProcedural(color,cop,forceModel);
  const g=new THREE.Group();
  model.rotation.y=0;                  // Kenney Car Kit faces +Z = our forward (W drove backwards with the flip)
  model.scale.setScalar(1.9);
  // each Kenney model has a different wheel-bottom, so a single lift floats some & sinks others —
  // measure the scaled bbox and drop the lowest point exactly onto y=0
  const _bb=new THREE.Box3().setFromObject(model);
  model.position.y=isFinite(_bb.min.y)?-_bb.min.y:.57;
  const fronts=[],backs=[];
  model.traverse(o=>{
    if(o.isMesh){o.castShadow=true;o.receiveShadow=true;if(o.material)o.material.envMapIntensity=.7;}
    if(o.name&&o.name.indexOf('wheel')===0)(o.name.indexOf('front')>=0?fronts:backs).push(o);
  });
  g.add(model);                        // children[0] = model, so the lean/pitch tilt still works
  // procedural driver door (Kenney cars have none) so the carjack open/steal animation can play —
  // but open-cockpit styles (race) don't get one
  let doorGrp=null;
  if(id!=='race'){
    doorGrp=new THREE.Group();
    const dgeo=new THREE.BoxGeometry(.08,.82,1.5);dgeo.translate(0,0,-.75);   // pivot at the door's front edge
    doorGrp.add(new THREE.Mesh(dgeo,new THREE.MeshStandardMaterial({color:0x20242b,roughness:.5,metalness:.4,envMapIntensity:.6})));
    doorGrp.position.set(-1.3,.95,.55);g.add(doorGrp);
  }
  const ud={wheels:[...fronts,...backs],hp:100,type:'car',rad:1.6,door:doorGrp,cls:cop?'police':(forceModel||'sedan')};
  if(forceModel==='taxi')ud.taxi=true;
  if(cop){
    const rl=new THREE.Mesh(new THREE.BoxGeometry(.5,.22,.4),new THREE.MeshStandardMaterial({color:0xff0000,emissive:0xff0000,emissiveIntensity:1}));
    const bl=new THREE.Mesh(new THREE.BoxGeometry(.5,.22,.4),new THREE.MeshStandardMaterial({color:0x0044ff,emissive:0x0044ff,emissiveIntensity:1}));
    rl.position.set(-.35,2.05,-.2);bl.position.set(.35,2.05,-.2);g.add(rl,bl);
    ud.beacons=[rl,bl];
  }
  const brakeMat=tailMat.clone();   // per-car tail/brake material so only the driven car lights up
  for(const sx of[-.7,.7]){const bl2=new THREE.Mesh(new THREE.BoxGeometry(.34,.18,.12),brakeMat);bl2.position.set(sx,.7,-2.45);g.add(bl2);}
  ud.brakeMat=brakeMat;
  g.userData=ud;scene.add(g);return g;
}
function makeCarProcedural(color,cop,forceModel){
  const brakeMat=tailMat.clone();
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
    const tl=new THREE.Mesh(new THREE.BoxGeometry(.5,.2,.1),brakeMat);tl.position.set(sx,.85,-2.52);g.add(tl);
  }
  const ud={wheels,hp:100,type:'car',rad:1.7,paint,door:doorGrp,cls:cop?'police':(forceModel||'sedan'),brakeMat};
  if(forceModel==='taxi')ud.taxi=true;
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
  g.userData={wheels,hp:55,type:'bike',rad:1.0,lean,paint,cls:'bike'};
  scene.add(g);return g;
}
function makePlane(color){   // light propeller plane (flyable) — nose at +z = our forward
  const g=new THREE.Group();
  const body=new THREE.MeshStandardMaterial({color,roughness:.4,metalness:.5,envMapIntensity:1}),
        dark=new THREE.MeshStandardMaterial({color:0x222831,roughness:.5,metalness:.5}),
        glass=new THREE.MeshStandardMaterial({color:0x0e151d,roughness:.05,metalness:.95,transparent:true,opacity:.6});
  const fus=new THREE.Mesh(new THREE.CylinderGeometry(.55,.42,6,12),body);fus.rotation.x=Math.PI/2;fus.position.y=1.4;fus.castShadow=true;g.add(fus);
  const nose=new THREE.Mesh(new THREE.ConeGeometry(.55,1.4,12),body);nose.rotation.x=-Math.PI/2;nose.position.set(0,1.4,3.3);g.add(nose);
  const cock=new THREE.Mesh(new THREE.SphereGeometry(.5,12,8),glass);cock.scale.set(1,.7,1.3);cock.position.set(0,1.85,1.2);g.add(cock);
  const wing=new THREE.Mesh(new THREE.BoxGeometry(9,.16,1.5),body);wing.position.set(0,1.45,.4);wing.castShadow=true;g.add(wing);
  const tailH=new THREE.Mesh(new THREE.BoxGeometry(3.2,.14,1.0),body);tailH.position.set(0,1.5,-2.7);g.add(tailH);
  const tailV=new THREE.Mesh(new THREE.BoxGeometry(.14,1.6,1.1),body);tailV.position.set(0,2.2,-2.7);tailV.castShadow=true;g.add(tailV);
  const prop=new THREE.Group();
  prop.add(new THREE.Mesh(new THREE.BoxGeometry(.18,2.6,.1),dark));
  prop.add(new THREE.Mesh(new THREE.BoxGeometry(2.6,.18,.1),dark));
  prop.position.set(0,1.4,4.0);g.add(prop);
  const wheelMat=new THREE.MeshStandardMaterial({color:0x14171b,roughness:.8});
  const mkWheel=(x,z)=>{const w=new THREE.Mesh(new THREE.CylinderGeometry(.34,.34,.24,12),wheelMat);w.rotation.z=Math.PI/2;w.position.set(x,.34,z);g.add(w);
    const strut=new THREE.Mesh(new THREE.BoxGeometry(.12,1.0,.12),dark);strut.position.set(x,.85,z);g.add(strut);return w;};
  const wheels=[mkWheel(-1.6,.6),mkWheel(1.6,.6),mkWheel(0,-2.4)];
  g.userData={wheels,hp:90,type:'plane',rad:3.2,prop,thr:0,roll:0,pitch:0};
  scene.add(g);return g;
}
function makeHeli(color){   // light helicopter — nose at +z = our forward; Arrows climb/descend, WASD move
  const g=new THREE.Group();
  const body=new THREE.MeshStandardMaterial({color,roughness:.4,metalness:.5,envMapIntensity:1}),
        dark=new THREE.MeshStandardMaterial({color:0x222831,roughness:.5,metalness:.55}),
        glass=new THREE.MeshStandardMaterial({color:0x0e151d,roughness:.05,metalness:.95,transparent:true,opacity:.55});
  const cab=new THREE.Mesh(new THREE.SphereGeometry(1.35,16,12),body);cab.scale.set(1,.95,1.25);cab.position.y=1.7;cab.castShadow=true;g.add(cab);
  const nose=new THREE.Mesh(new THREE.SphereGeometry(1.0,14,10),glass);nose.scale.set(1,.85,1.1);nose.position.set(0,1.75,1.05);g.add(nose);
  const boom=new THREE.Mesh(new THREE.CylinderGeometry(.26,.13,4.4,10),body);boom.rotation.x=Math.PI/2;boom.position.set(0,2.05,-3.0);boom.castShadow=true;g.add(boom);
  const fin=new THREE.Mesh(new THREE.BoxGeometry(.12,1.0,.7),body);fin.position.set(0,2.5,-4.9);g.add(fin);
  // main rotor (spins about Y)
  const rotor=new THREE.Group();const hub=new THREE.Mesh(new THREE.CylinderGeometry(.18,.18,.3,8),dark);rotor.add(hub);
  for(let i=0;i<2;i++){const bl=new THREE.Mesh(new THREE.BoxGeometry(7.4,.06,.34),dark);bl.rotation.y=i*Math.PI/2;rotor.add(bl);}
  rotor.position.set(0,3.05,0);g.add(rotor);
  const mast=new THREE.Mesh(new THREE.CylinderGeometry(.1,.1,1.0,8),dark);mast.position.set(0,2.6,0);g.add(mast);
  // tail rotor (spins about X)
  const trotor=new THREE.Group();
  for(let i=0;i<2;i++){const bl=new THREE.Mesh(new THREE.BoxGeometry(.06,1.5,.18),dark);bl.rotation.x=i*Math.PI/2;trotor.add(bl);}
  trotor.position.set(.3,2.55,-5.1);g.add(trotor);
  // skids
  const skidMat=new THREE.MeshStandardMaterial({color:0x14171b,roughness:.7,metalness:.4});
  for(const sx of[-1.1,1.1]){const rail=new THREE.Mesh(new THREE.CylinderGeometry(.09,.09,3.4,8),skidMat);rail.rotation.x=Math.PI/2;rail.position.set(sx,.18,.1);g.add(rail);
    for(const sz of[-.9,1.1]){const leg=new THREE.Mesh(new THREE.BoxGeometry(.1,.9,.1),skidMat);leg.position.set(sx,.65,sz);g.add(leg);}}
  g.userData={wheels:[],hp:140,type:'heli',rad:3.0,rotor,trotor,spin:0,spd:0,roll:0,pitch:0};
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
  g.userData={wheels,hp:55,type:'auto',rad:1.3,paint:yellow,cls:'auto'};
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
  }else if(kind==='knife'){
    add(.035,.05,.5,new THREE.MeshPhongMaterial({color:0xd8dde2,shininess:120,specular:0xffffff}),0,.02,.22); // blade
    add(.05,.05,.16,dark,0,0,-.08);    // handle
    g.userData.muzzle=.0;
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
  const guns={knife:makeGun('knife'),pistol:makeGun('pistol'),uzi:makeGun('uzi'),shotgun:makeGun('shotgun')};
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
const MAXP=300;
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
    _rigid(iHip,i,_oHip);_rigid(iTorso,i,_oTorso);
    if(p.decap){iHead.setMatrixAt(i,_zero);iHair.setMatrixAt(i,_zero);iFace.setMatrixAt(i,_zero);}   // head flew off
    else{_rigid(iHead,i,_oHead);_rigid(iHair,i,_oHair);_rigid(iFace,i,_oFace);}
  }
  for(const m of CROWD)m.instanceMatrix.needsUpdate=true;
  if(colorsDirty){for(const m of CROWD)if(m.instanceColor)m.instanceColor.needsUpdate=true;colorsDirty=false;}
}

// ---------- audio ----------
let actx=null,eng={},noiseBuf=null,skidGain=null,masterGain=null;
function initAudio(){
  if(actx)return;
  try{
    actx=new (window.AudioContext||window.webkitAudioContext)();
    masterGain=actx.createGain();masterGain.gain.value=settings.volume;masterGain.connect(actx.destination);
    const o=actx.createOscillator();o.type='sawtooth';o.frequency.value=70;
    const lp=actx.createBiquadFilter();lp.type='lowpass';lp.frequency.value=420;
    const g=actx.createGain();g.gain.value=0;
    o.connect(lp).connect(g).connect(masterGain);o.start();
    eng={o,g};
    noiseBuf=actx.createBuffer(1,actx.sampleRate*.5,actx.sampleRate);
    const d=noiseBuf.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;
    const ns=actx.createBufferSource();ns.buffer=noiseBuf;ns.loop=true;
    skidGain=actx.createGain();skidGain.gain.value=0;
    const bp=actx.createBiquadFilter();bp.type='bandpass';bp.frequency.value=900;
    ns.connect(bp).connect(skidGain).connect(masterGain);ns.start();
    const so=actx.createOscillator();so.type='triangle';so.frequency.value=700;
    const sg=actx.createGain();sg.gain.value=0;
    so.connect(sg).connect(masterGain);so.start();
    eng.siren=so;eng.sirenG=sg;
    const ho=actx.createOscillator();ho.type='square';ho.frequency.value=392;
    const hg=actx.createGain();hg.gain.value=0;
    ho.connect(hg).connect(masterGain);ho.start();
    eng.hornG=hg;
  }catch(e){}
}
function crashSound(i){
  if(!actx)return;
  const s=actx.createBufferSource();s.buffer=noiseBuf;
  const g=actx.createGain();g.gain.setValueAtTime(Math.min(.5,i*.6),actx.currentTime);
  g.gain.exponentialRampToValueAtTime(.001,actx.currentTime+.25);
  const lp=actx.createBiquadFilter();lp.type='lowpass';lp.frequency.value=600;
  s.connect(lp).connect(g).connect(masterGain);s.start();s.stop(actx.currentTime+.3);
}
function gunSound(){
  if(!actx)return;
  const s=actx.createBufferSource();s.buffer=noiseBuf;
  const g=actx.createGain();g.gain.setValueAtTime(.22,actx.currentTime);
  g.gain.exponentialRampToValueAtTime(.001,actx.currentTime+.09);
  const hp=actx.createBiquadFilter();hp.type='highpass';hp.frequency.value=1200;
  s.connect(hp).connect(g).connect(masterGain);s.start();s.stop(actx.currentTime+.1);
}
function chime(){
  if(!actx)return;
  [880,1320].forEach((f,i)=>{
    const o=actx.createOscillator();o.frequency.value=f;
    const g=actx.createGain();g.gain.setValueAtTime(.15,actx.currentTime+i*.12);
    g.gain.exponentialRampToValueAtTime(.001,actx.currentTime+i*.12+.3);
    o.connect(g).connect(masterGain);o.start(actx.currentTime+i*.12);o.stop(actx.currentTime+i*.12+.35);
  });
}
// dynamic synthesized speech ("simlish" formant blips) — no text, distance-attenuated.
// seed shapes the intonation; kind 'talk' = casual, 'shout' = panic/aggro, 'gruff' = lower voice.
function speak(seed,x,z,kind){
  if(!actx)return;
  const dist=Math.hypot((x??player.x)-player.x,(z??player.z)-player.z);
  const shout=kind==='shout';
  const vol=M.clamp(1-dist/42,0,1)*(shout?.5:kind==='gruff'?.2:.16);   // casual talk is quiet & gentle, not a yell
  if(vol<=.02)return;
  seed=(Math.abs(seed|0)%17);
  const base=shout?205:kind==='gruff'?95:120+seed*7;
  const out=actx.createGain();out.gain.value=vol;out.connect(masterGain);
  const n=shout?3+(seed%3):4+(seed%3);
  let t=actx.currentTime;
  for(let i=0;i<n;i++){
    const o=actx.createOscillator();o.type=shout?'sawtooth':'triangle';   // soft triangle for talk/gruff; harsh saw only for shouts
    const syl=Math.sin(seed*1.3+i*1.7)*0.5+0.5;          // per-syllable vowel pitch
    const f=base*(0.78+syl*0.85);
    o.frequency.setValueAtTime(f,t);o.frequency.linearRampToValueAtTime(f*(0.9+syl*0.3),t+0.09);
    const bp=actx.createBiquadFilter();bp.type='bandpass';bp.frequency.value=650+(i%3)*620+syl*400;bp.Q.value=shout?7:3;
    const g=actx.createGain();g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(1,t+0.018);
    g.gain.setValueAtTime(1,t+0.09);g.gain.linearRampToValueAtTime(0,t+0.125);
    o.connect(bp).connect(g).connect(out);o.start(t);o.stop(t+0.15);
    t+=0.105+syl*0.05;
  }
  setTimeout(()=>{try{out.disconnect();}catch(e){}},(t-actx.currentTime)*1000+220);
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
  const d=pdist(p.x,p.z);if(d<bd){bd=d;best=p;}}return best;}
addEventListener('keydown',e=>{
  if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code))e.preventDefault();
  keys[e.code]=true;
  if(e.code==='KeyM')toggleMap();
  if(e.code==='KeyQ')cycleWeapon();
  if(e.code==='KeyE')pressedE=true;
  if(e.code==='KeyT')talkReq=true;
  if(e.code==='Digit1')startTaxiJob();
});
addEventListener('keyup',e=>keys[e.code]=false);
const canvasEl=renderer.domElement;
canvasEl.addEventListener('click',()=>{if(started&&!bigOpen&&!document.pointerLockElement&&canvasEl.requestPointerLock)canvasEl.requestPointerLock();});
document.addEventListener('pointerlockchange',()=>{pointerLocked=document.pointerLockElement===canvasEl;});
addEventListener('mousemove',e=>{
  if(!started)return;
  camYaw-=e.movementX*0.0026*settings.sensitivity;
  camPitch=M.clamp(camPitch+e.movementY*0.0024*settings.sensitivity*(settings.invertY?-1:1),-0.5,1.0);
  lastMouse=perf;
});
// ---------- settings ----------
let settings=loadSettings();
function setQuality(q){
  lowGfx=(q==='low');
  if(ssaoPass)ssaoPass.enabled=(q==='high');
  if(smaaPass)smaaPass.enabled=(q!=='low');
  if(bloomPass)bloomPass.enabled=(q!=='low');
  renderer.shadowMap.enabled=(q!=='low');
  renderer.setPixelRatio(Math.min(devicePixelRatio,q==='high'?2:q==='med'?1.5:1));
}
function applySettings(s){
  settings=s;
  if(masterGain)masterGain.gain.value=s.volume;
  setQuality(s.quality||'high');
}
applySettings(settings);
{ // settings panel DOM wiring (reused by main menu + pause)
  const $=id=>document.getElementById(id);
  const sync=()=>{$('setVol').value=settings.volume;$('setSens').value=settings.sensitivity;$('setInvert').checked=settings.invertY;$('setQuality').value=settings.quality;};
  const change=()=>{applySettings({volume:+$('setVol').value,sensitivity:+$('setSens').value,invertY:$('setInvert').checked,quality:$('setQuality').value});saveSettings(settings);};
  ['setVol','setSens','setInvert','setQuality'].forEach(id=>$(id).addEventListener('input',change));
  window.__openSettings=from=>{sync();$('settings').dataset.from=from;$('settings').style.display='flex';};
  $('setBack').addEventListener('click',()=>{$('settings').style.display='none';const f=$('settings').dataset.from;if(f==='menu')$('intro').style.display='flex';else if(f==='pause')$('pause').style.display='flex';});
  $('mSettings').addEventListener('click',()=>{$('intro').style.display='none';window.__openSettings('menu');});
  $('mNew').addEventListener('click',()=>start(false));
  $('mContinue').addEventListener('click',()=>start(true));
  $('mNew').disabled=!assetsReady;   // gate start on world/asset readiness (markReady enables)
  if(assetsReady){if(hasSave())$('mContinue').disabled=false;const l=$('loadlbl');if(l)l.style.display='none';}
}
addEventListener('mousedown',()=>{if(started&&!bigOpen)firing=true;});
addEventListener('mouseup',()=>firing=false);
function start(continueSave){if(started||!assetsReady)return;started=true;initAudio();
  if(continueSave){const sv=loadProgress();if(sv){money=sv.money;owned.length=0;for(const w of sv.owned)owned.push(w);for(const k in sv.ammo)ammo[k]=sv.ammo[k];curW=0;weaponHUD();}}
  document.getElementById('intro').style.display='none';
  showMsg(continueSave?'Welcome back to Gully Run':'Welcome to Gully Run — steal a car (E) and explore!');
  // grab pointer lock on start so the mouse gives unbounded 360° look (first click hits #intro, not the canvas)
  if(canvasEl.requestPointerLock)canvasEl.requestPointerLock();}
if(DEBUG)window.__start=c=>start(!!c);   // test entry (menu-bypass); prod boots only via menu buttons
const inp=()=>({
  up:keys.KeyW||keys.ArrowUp, dn:keys.KeyS||keys.ArrowDown,
  lf:keys.KeyA||keys.ArrowLeft, rt:keys.KeyD||keys.ArrowRight,
  hb:keys.Space, boost:keys.ShiftLeft||keys.ShiftRight, horn:keys.KeyH
});

// ---------- game state ----------
let money=500,wanted=0,crimeCool=0,wantedTimer=0,playerHp=100;
let tod=.32;
const player={x:spawnX+5,z:spawnZ-4,vx:0,vz:0,vy:0,y:0,climbV:0,heading:Math.PI/2,inCar:false,steer:0,airborne:false,meleeAnim:0,jumpHeld:false};
const pdist=(x,z)=>Math.hypot(player.x-x,player.z-z);   // distance from the player to a world point (symmetric)
const char=buildCharacter(0xe8b88f,0x223a5e,0x222831,0x2b1b0e,false);scene.add(char);char.position.set(player.x,0,player.z);
let vehicle=null,exitCool=0,dead=false;
// you start on foot — your yellow car waits at the curb, a bike across the street
const parked=[];   // populated by boot() once vehicle GLB models have loaded

// ---------- weapons ----------
const WEAPONS={
  knife:{melee:true,rate:.34,dmg:55,reach:2.3},
  pistol:{rate:.32,dmg:40,n:1,spread:.015,ammo0:36},
  uzi:{rate:.09,dmg:22,n:1,spread:.05,ammo0:120},
  shotgun:{rate:.85,dmg:30,n:6,spread:.16,ammo0:18}
};
let meleeT=0;
let owned=['fist'],curW=0,ammo={};
function weaponHUD(){
  const w=owned[curW];
  const melee=w==='fist'||(WEAPONS[w]&&WEAPONS[w].melee);
  document.getElementById('weapon').textContent=w==='fist'?'FISTS':melee?w.toUpperCase():w.toUpperCase()+'  '+ammo[w];
  document.getElementById('xh').style.display=melee?'none':'block';   // no crosshair for melee
}
function cycleWeapon(){curW=(curW+1)%owned.length;weaponHUD();}
function giveWeapon(w){
  if(!owned.includes(w)){owned.push(w);curW=owned.length-1;}
  if(WEAPONS[w].melee)ammo[w]=Infinity;else ammo[w]=(ammo[w]||0)+WEAPONS[w].ammo0;
  chime();showMsg(w.toUpperCase()+' acquired!');weaponHUD();
}
// pickups
const pickups=[];
const gunMat=new THREE.MeshPhongMaterial({color:0x2ecc71,emissive:0x2ecc71,emissiveIntensity:.5});
const knifeMat=new THREE.MeshPhongMaterial({color:0xcfd6dc,emissive:0x3a7fa0,emissiveIntensity:.5,shininess:120,specular:0xffffff});
function spawnPickup(px,pz,kind){
  kind=kind||pick(['pistol','pistol','uzi','shotgun']);
  const g=new THREE.Group();
  if(kind==='knife'){
    const bl=new THREE.Mesh(new THREE.BoxGeometry(.1,.05,.8),knifeMat);bl.position.z=.18;
    const hd=new THREE.Mesh(new THREE.BoxGeometry(.13,.13,.26),new THREE.MeshPhongMaterial({color:0x222428}));hd.position.z=-.32;
    g.add(bl,hd);
  }else{
    const b1=new THREE.Mesh(new THREE.BoxGeometry(.9,.3,.3),gunMat);
    const b2=new THREE.Mesh(new THREE.BoxGeometry(.25,.5,.25),gunMat);b2.position.set(-.25,-.3,0);
    g.add(b1,b2);
  }
  if(px===undefined){const it=pick(inters);px=it.x+HALF+rnd(1,3);pz=it.z+HALF+rnd(1,3);}
  g.position.set(px,1.1,pz);
  g.userData.kind=kind;
  scene.add(g);pickups.push(g);
}
for(let i=0;i<12;i++)spawnPickup();
for(let i=0;i<6;i++)spawnPickup(undefined,undefined,'knife');   // knives scattered across the map
spawnPickup(spawnX+5,spawnZ-4,'pistol');   // starter weapon right where you begin
spawnPickup(spawnX+5,spawnZ-5,'knife');    // a knife within reach of spawn
// bullets
const bullets=[];
const bulletGeo=new THREE.BoxGeometry(.09,.09,.55);
const bulletMatY=new THREE.MeshBasicMaterial({color:0xffdd66});
// civilians within radius bolt away from a gunshot (flee logic already runs them away from the player)
function scarePeds(x,z,r){const r2=r*r;
  for(const p of peds){if(p.state==='down'||p.state==='talk')continue;
    const dx=p.x-x,dz=p.z-z;if(dx*dx+dz*dz<r2){p.state='flee';if(!(p.timer>3.5))p.timer=3.5;}}}
function shoot(x,y,z,ang,from,dmg,vy){
  if(bullets.length>60)return;
  const m=new THREE.Mesh(bulletGeo,bulletMatY);
  m.position.set(x,y,z);m.rotation.y=ang;scene.add(m);
  bullets.push({m,vx:Math.sin(ang)*1.6,vz:Math.cos(ang)*1.6,vy:vy||0,life:.55,from,dmg});
  gunSound();
  if(from==='player')scarePeds(x,z,15);
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
  const playerCar=makeCar(0xf4c20d,false,'taxi');playerCar.userData.taxi=true;playerCar.position.set(spawnX+LANE,0,spawnZ-7);
  {const sign=new THREE.Mesh(new THREE.BoxGeometry(.5,.3,1.0),new THREE.MeshStandardMaterial({color:0xffd23e,emissive:0xffb000,emissiveIntensity:.5}));sign.position.set(0,2.15,-.1);playerCar.add(sign);}
  const playerBike=makeBike(0xcc2222);playerBike.position.set(spawnX-LANE-1,0,spawnZ+8);playerBike.rotation.y=Math.PI;
  parked.push(playerCar,playerBike);
  // parked planes lined up on the runway (face +x, down the runway)
  for(let i=0;i<2;i++){const pl=makePlane(pick([0xecf0f1,0xc0392b]));
    pl.position.set(airport.cx-45+i*55,0,airport.cz);pl.rotation.y=Math.PI/2;parked.push(pl);}
  // a helicopter parked beside the runway
  {const hl=makeHeli(0x1f6fae);hl.position.set(airport.cx+5,0,airport.cz-34);hl.rotation.y=Math.PI;parked.push(hl);}
  for(let i=0;i<42;i++)spawnAI(false);
  for(let i=0;i<11;i++)spawnAI(true);
  for(let i=0;i<4;i++)spawnPatrol();                 // ambient patrol cruisers in traffic
  for(let i=0;i<6;i++){const it=pick(inters);spawnCopWalker(it.x+HALF+rnd(-2,2),it.z+HALF+rnd(-2,2));}  // foot officers
  // a steal-able cruiser parked outside the police station (taking it = instant 2 stars)
  for(const Lm of landmarks)if(Lm.type==='police'){const pc=makeCar(0x0d0d0d,true);
    if(pc.userData.beacons)pc.userData.beacons.forEach(b=>b.material.emissiveIntensity=.08);
    pc.position.set(Lm.x+Lm.hw+3.5,0,Lm.z);pc.rotation.y=Math.PI/2;parked.push(pc);break;}
  buildTrees();
}
// ---------- cheat codes (just type the letters, classic arcade style) ----------
let cheatBuf='';
function spawnCheatVeh(v,msg){
  v.position.set(player.x+Math.cos(player.heading)*4.5,0,player.z-Math.sin(player.heading)*4.5);
  v.rotation.y=player.heading;if(!parked.includes(v))parked.push(v);chime();showMsg(msg);
}
const CHEATS={
  TOOLED:()=>{['knife','pistol','uzi','shotgun'].forEach(giveWeapon);showMsg('🔫 FULLY ARMED');},
  HEALTHY:()=>{playerHp=100;if(vehicle)vehicle.userData.hp=100;chime();showMsg('❤ FULL HEALTH');},
  RICH:()=>{money+=50000;chime();showMsg('💰 +50,000');},
  CLEAN:()=>{wanted=0;wantedTimer=0;updateStars();clearCops();showMsg('🚔 WANTED CLEARED');},
  HOT:()=>{addWanted(5);showMsg('🔥 FIVE STARS');},
  WHEELS:()=>spawnCheatVeh(makeCar(0xff2d2d,false,'race'),'🏎 RACER SPAWNED'),
  CHOPPER:()=>spawnCheatVeh(makeHeli(0x111111),'🚁 CHOPPER SPAWNED'),
  FLY:()=>spawnCheatVeh(makePlane(0xffffff),'✈ PLANE SPAWNED'),
  BANG:()=>{const a=player.heading;explode({x:player.x+Math.sin(a)*6,z:player.z+Math.cos(a)*6});},
  VIGI:()=>startVigilante(),
  PEACE:()=>stopVigilante(),
  RACE:()=>startRace(),
  COURIER:()=>startCourier()
};
addEventListener('keydown',e=>{
  if(!e.key||e.key.length!==1||!/[a-z]/i.test(e.key))return;
  cheatBuf=(cheatBuf+e.key.toUpperCase()).slice(-12);
  for(const code in CHEATS)if(cheatBuf.endsWith(code)){CHEATS[code]();cheatBuf='';break;}
});
// instance the collected tree spots from CC0 GLB trees (procedural fallback if models missing)
function buildTrees(){
  const _q=new THREE.Quaternion(),_p=new THREE.Vector3(),_s=new THREE.Vector3(),_up=new THREE.Vector3(0,1,0),
        _spot=new THREE.Matrix4(),_full=new THREE.Matrix4(),_m=new THREE.Matrix4();
  // each tree GLB has SEVERAL parts (trunk + foliage, distinct materials) — capture every mesh with its local transform
  const types=[];
  for(const id of TREEGLBS){
    const root=assets.spawn(id);if(!root)continue;root.updateMatrixWorld(true);
    const parts=[];root.traverse(o=>{if(o.isMesh){o.updateWorldMatrix(true,false);parts.push({geo:o.geometry,mat:o.material,lm:o.matrixWorld.clone()});}});
    if(parts.length)types.push(parts);
  }
  if(!types.length){ // fallback to the old cylinder+sphere instancing
    const n=treeSpots.length;
    const trunkI=new THREE.InstancedMesh(treeGeoT,treeMatT,n),leafI=new THREE.InstancedMesh(treeGeoL,treeMatL,n);
    trunkI.castShadow=leafI.castShadow=true;scene.add(trunkI,leafI);
    treeSpots.forEach((sp,i)=>{const[x,z,sc]=sp;_q.setFromAxisAngle(_up,rnd(0,7));
      _p.set(x,1.7*sc,z);_s.setScalar(sc);_m.compose(_p,_q,_s);trunkI.setMatrixAt(i,_m);
      _p.set(x,4.3*sc,z);_s.setScalar(sc*1.15);_m.compose(_p,_q,_s);leafI.setMatrixAt(i,_m);});
    trunkI.instanceMatrix.needsUpdate=leafI.instanceMatrix.needsUpdate=true;return;
  }
  const BASE=3.4;                       // GLB trees ~1.7u tall → ~5.8u
  const buckets=types.map(()=>[]);
  for(const sp of treeSpots)buckets[(Math.random()*types.length)|0].push(sp);
  types.forEach((parts,ti)=>{
    const spots=buckets[ti];if(!spots.length)return;
    const insts=parts.map(pt=>{const im=new THREE.InstancedMesh(pt.geo,pt.mat,spots.length);im.castShadow=true;scene.add(im);return im;});
    spots.forEach((sp,i)=>{const[x,z,sc]=sp;_q.setFromAxisAngle(_up,rnd(0,7));_p.set(x,0,z);_s.setScalar(BASE*sc);_spot.compose(_p,_q,_s);
      parts.forEach((pt,pi)=>{_full.multiplyMatrices(_spot,pt.lm);insts[pi].setMatrixAt(i,_full);});});
    insts.forEach(im=>im.instanceMatrix.needsUpdate=true);
  });
}
// idle officers stationed inside each police station
for(const Lm of landmarks)if(Lm.type==='police'){
  for(let i=0;i<3;i++){const c=makeCiv(true);
    c.position.set(Lm.x+rnd(-Lm.hw*.5,Lm.hw*.5),0,Lm.z+rnd(-Lm.hd*.5,Lm.hd*.5));
    c.rotation.y=rnd(0,7);scene.add(c);}
}

// ---------- gangs (hostile NPCs that take offence, draw weapons and chase) ----------
const gangs=[];
// ---------- vigilante mission: cull gang members in escalating waves for cash ----------
const vigil={active:false,kills:0,goal:5};
function startVigilante(){if(vigil.active)return;vigil.active=true;vigil.kills=0;vigil.goal=5;chime();showMsg('🎯 VIGILANTE — take down '+vigil.goal+' gangsters!');}
function stopVigilante(){if(!vigil.active)return;vigil.active=false;showMsg('🕊 Vigilante ended');}
function vigilKill(){
  vigil.kills++;money+=600;
  if(vigil.kills>=vigil.goal){money+=4000;vigil.goal+=2;vigil.kills=0;chime();showMsg('💰 Wave cleared! +4000 — next target: '+vigil.goal);}
  else showMsg('🎯 Vigilante '+vigil.kills+'/'+vigil.goal+'  (+600)');
}
const GANGc=[0x14110f,0x3a0d0d,0x10203a,0x14331a,0x2a1133];   // dark gang colours
function spawnGang(x,z){
  const g=buildCharacter(pick(SKINc),pick(GANGc),0x15171c,pick(HAIRc),false);
  scene.add(g);g.position.set(x,0,z);g.rotation.y=rnd(0,7);
  const weap=Math.random()<.5?'pistol':'uzi';
  g.userData.gunMount.visible=true;g.userData.guns[weap].visible=true;  // weapon visible in hand
  gangs.push({mesh:g,x,z,hp:130,state:'idle',weap,walk:0,fireT:rnd(.6,1.6),wanderA:rnd(0,7),
    speakT:rnd(2,6),wound:false});
}
function provokeGang(g){
  if(g.state==='aggro'||g.state==='dead')return;
  g.state='aggro';g.fireT=rnd(.2,.6);speak(8,g.x,g.z,'shout');
}
function killGang(g){
  if(g.state==='dead')return;g.state='dead';
  g.mesh.rotation.set(Math.PI/2,g.mesh.rotation.y,0);g.mesh.position.y=.32;
  spawnBlood({x:g.x,z:g.z});
  if(vigil.active)vigilKill();
  setTimeout(()=>{scene.remove(g.mesh);const i=gangs.indexOf(g);if(i>=0)gangs.splice(i,1);},9000);
}
function decapGang(g){
  if(g.state==='dead')return;
  decapFx(g.x,g.z,0xd9a173);
  for(const idx of [6,7,8])if(g.mesh.children[idx])g.mesh.children[idx].visible=false;   // head/hair/face off
  killGang(g);
}
function gangUpdate(g,dtF){
  if(g.state==='dead')return;
  const m=g.mesh,dx=player.x-g.x,dz=player.z-g.z,d=Math.hypot(dx,dz),ang=Math.atan2(dx,dz);
  const L=m.userData.limbs;
  if(g.state==='aggro'){
    m.rotation.y=ang;m.userData.gunMount.rotation.y=0;     // body faces you → gun (local +z) points at you
    if(d>2.4){
      const sp=g.wound?.06:.11;
      const pp={x:g.x+Math.sin(ang)*sp*dtF,z:g.z+Math.cos(ang)*sp*dtF,vx:0,vz:0};
      resolveCircle(pp,.5);resolveActors(pp,.5);g.x=pp.x;g.z=pp.z;
      g.walk+=(g.wound?.13:.22)*dtF;const s=Math.sin(g.walk*6);L[0].rotation.x=s*.6;L[1].rotation.x=-s*.6;
    }
    L[3].rotation.set(-1.5,0,-.13);L[2].rotation.set(-1.32,0,.2);    // both arms up on the gun
    g.fireT-=dtF/60;
    if(g.fireT<=0&&d<32){g.fireT=g.weap==='uzi'?.15:.62;
      const muz=1.6;shoot(g.x+Math.sin(ang)*muz,1.42,g.z+Math.cos(ang)*muz,ang+rnd(-.08,.08),'gang',g.weap==='uzi'?11:17);
      if(Math.random()<.12)speak(8,g.x,g.z,'shout');}
    if(d>72)g.state='idle';
  }else if(g.state==='flee'){
    m.rotation.y=ang+Math.PI;m.userData.gunMount.visible=false;
    const pp={x:g.x-Math.sin(ang)*.13*dtF,z:g.z-Math.cos(ang)*.13*dtF,vx:0,vz:0};
    resolveCircle(pp,.5);g.x=pp.x;g.z=pp.z;
    g.walk+=.3*dtF;const s=Math.sin(g.walk*6);L[0].rotation.x=s*.7;L[1].rotation.x=-s*.7;
    g.fireT-=dtF/60;if(g.fireT<=0)g.state='idle';
  }else{ // idle wander; offence taken if you draw a weapon close or barge into them
    if(Math.random()<.01)g.wanderA+=rnd(-1,1);
    const pp={x:g.x+Math.sin(g.wanderA)*.03*dtF,z:g.z+Math.cos(g.wanderA)*.03*dtF,vx:0,vz:0};
    resolveCircle(pp,.5);g.x=pp.x;g.z=pp.z;m.rotation.y=g.wanderA;
    g.walk+=.05*dtF;const s=Math.sin(g.walk*4)*.3;L[0].rotation.x=s;L[1].rotation.x=-s;L[2].rotation.set(0,0,0);L[3].rotation.set(0,0,0);
    g.speakT-=dtF/60;if(g.speakT<=0){g.speakT=rnd(4,9);speak(2,g.x,g.z,'gruff');}
    const armed=owned[curW]!=='fist';
    if(d<4.5&&((armed&&!player.inCar)||Math.hypot(player.vx,player.vz)>.3))provokeGang(g);
  }
  m.position.set(M.clamp(g.x,-WORLD+2,WORLD-2),m.position.y,M.clamp(g.z,-WORLD+2,WORLD-2));
  g.x=m.position.x;g.z=m.position.z;
}
for(let i=0;i<8;i++){const it=pick(inters);if(Math.hypot(it.x-spawnX,it.z-spawnZ)<40){i--;continue;}
  spawnGang(it.x+HALF+rnd(-2,2),it.z+HALF+rnd(-2,2));}

function aiUpdate(ai,dtF){
  const m=ai.mesh,L=ai.line;
  const pos=ai.axis==='z'?m.position.z:m.position.x;
  let next=null,nextLine=null;
  if(ai.dir>0){for(const W of L.cross)if(W.c>pos+.1){next=W.c;nextLine=W;break;}}
  else{for(let i=L.cross.length-1;i>=0;i--)if(L.cross[i].c<pos-.1){next=L.cross[i].c;nextLine=L.cross[i];break;}}
  // panic: during a pursuit nearby civilian traffic floors it to clear the area (still obeys the brakes below)
  let panic=1;ai.panic=false;
  if(!ai.police&&wanted>=2){const pd=pdist(m.position.x,m.position.z);
    if(pd<48){panic=1.6;ai.panic=true;}}
  let target=ai.jacked?0:ai.base*panic;
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
  ai.cur+=M.clamp(target-ai.cur,-.05*dtF,(ai.panic?.03:.015)*dtF);   // panicking drivers accelerate harder
  const newPos=pos+ai.dir*ai.cur*dtF;
  if(ai.axis==='z')m.position.z=newPos;else m.position.x=newPos;
  // turn at intersections (after moving, so newPos applied to the old axis)
  if(nextLine&&(next-pos)*ai.dir>0&&(next-newPos)*ai.dir<=0&&Math.random()<(ai.panic?.7:.45)){
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
  if(ai.police&&m.userData.beacons){const on=wanted>0&&Math.sin(perf*16)>0;   // lights run only during a pursuit
    m.userData.beacons[0].material.emissiveIntensity=on?2:.08;
    m.userData.beacons[1].material.emissiveIntensity=(wanted>0&&!on)?2:.08;}
}

// ---------- pedestrians ----------
const peds=[];
function spawnPed(){
  if(peds.length>=MAXP)return;
  const axis=Math.random()<.5?'z':'x';
  const line=axis==='z'?pick(cityX):pick(cityZ);
  const off=(Math.random()<.5?1:-1)*(HALF-1.4),pos=rnd(line.a+12,line.b-12);
  const i=peds.length;
  const sp=rnd(.045,.075);
  peds.push({axis,line,off,pos,dir:Math.random()<.5?1:-1,speed:sp,baseSpeed:sp,
    hp:45+(Math.random()*20|0),wounded:false,decap:false,
    state:'walk',t:Math.random()*9,timer:0,local:false,sw:0,bob:0,dyaw:0,heading:0,
    x:axis==='z'?line.c+off:pos,z:axis==='z'?pos:line.c+off});
  setCrowdColor(i,pick(SKIN),pick(SHIRT),pick(PANTS),pick(HAIR));
}
for(let i=0;i<200;i++)spawnPed();
function downPed(p){
  if(p.state==='down')return;
  p.state='down';p.timer=12;p.dyaw=Math.random()*7;p.sw=0;
  spawnBlood({x:p.x,z:p.z});
}
// body shot → wounded (limps, slower, panics). second shot finishes.
function woundPed(p){
  if(p.state==='down')return;
  p.wounded=true;p.speed=p.baseSpeed*.42;
  if(p.state!=='flee'){p.state='flee';p.timer=4.5;}
  spawnBlood({x:p.x,z:p.z});
}
// head shot → instant decapitation + death
function decapPed(p){
  if(p.decap)return;
  p.decap=true;decapFx(p.x,p.z,0xd9a173);
  downPed(p);p.timer=15;
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
    p.speakT=(p.speakT||0)-dtF/60;
    if(p.speakT<=0){p.speakT=rnd(1.3,2.1);speak(p.talkSeed||1,p.x,p.z,'talk');}  // dynamic spoken lines
    if(p.talkT<=0){p.state='walk';if(talkingPed===p)talkingPed=null;}
    return;
  }
  if(p.state==='down'){
    p.timer-=dtF/60;
    if(p.timer<=0){
      // recover to full health/state on respawn
      p.hp=45+(Math.random()*20|0);p.wounded=false;p.decap=false;p.speed=p.baseSpeed;
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
    const fs=p.wounded?.09:.16;   // the wounded can only stagger away
    const pp={x:p.x+Math.sin(ang)*fs*dtF,z:p.z+Math.cos(ang)*fs*dtF,vx:0,vz:0};
    resolveCircle(pp,.4);p.x=pp.x;p.z=pp.z;p.heading=ang;p.t+=(p.wounded?.25:.4)*dtF;
    if(p.timer<=0){p.state='walk';p.pos=p.axis==='z'?p.z:p.x;p.off=(p.axis==='z'?p.x:p.z)-p.line.c;}
  }else{
    p.pos+=p.dir*p.speed*dtF;p.t+=.18*dtF;
    if(p.pos>p.line.b-8||p.pos<p.line.a+8)p.dir*=-1;
    if(p.axis==='z'){p.x=p.line.c+p.off;p.z=p.pos;p.heading=p.dir>0?0:Math.PI;}
    else{p.x=p.pos;p.z=p.line.c+p.off;p.heading=p.dir>0?Math.PI/2:-Math.PI/2;}
  }
  const sn=Math.sin(p.t*6),wm=p.wounded?.5:1;p.sw=sn*wm;p.bob=Math.abs(sn)*.045*wm; // wounded limp
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
// ---------- ambient police patrols (always present, alongside traffic & crowds) ----------
function spawnPatrol(){
  const axis=Math.random()<.5?'z':'x',line=axis==='z'?pick(cityX):pick(cityZ),dir=Math.random()<.5?1:-1;
  const m=makeCar(0x0d0d0d,true);if(m.userData.beacons)m.userData.beacons.forEach(b=>b.material.emissiveIntensity=.08);
  const occupant=buildOccupant(true);pose(occupant,true);occupant.scale.setScalar(.85);occupant.position.set(-.45,.18,-.2);m.add(occupant);
  const along=rnd(line.a+15,line.b-15);
  if(axis==='z')m.position.set(line.c+laneOff(axis,dir),0,along);else m.position.set(along,0,line.c+laneOff(axis,dir));
  m.rotation.y=axis==='z'?(dir>0?0:Math.PI):(dir>0?Math.PI/2:-Math.PI/2);
  aiCars.push({mesh:m,axis,dir,line,cur:0,base:rnd(.3,.45),occupant,jacked:false,police:true});
}
// foot officers strolling the sidewalks; they turn hostile (pursue + open fire) once you're wanted
const copWalkers=[];
function spawnCopWalker(x,z){const m=makeCiv(true);scene.add(m);m.position.set(x,0,z);
  copWalkers.push({mesh:m,x,z,wanderA:rnd(0,7),walk:0,fireT:rnd(.5,1.5)});}
function copWalkerUpdate(cw,dtF){
  const m=cw.mesh,dx=player.x-cw.x,dz=player.z-cw.z,d=Math.hypot(dx,dz),ang=Math.atan2(dx,dz),L=m.userData.limbs;
  if(wanted>0&&d<55){     // hostile pursuit once you are wanted
    m.rotation.y=ang;
    if(d>2.6){const pp={x:cw.x+Math.sin(ang)*.1*dtF,z:cw.z+Math.cos(ang)*.1*dtF,vx:0,vz:0};resolveCircle(pp,.5);resolveActors(pp,.5);cw.x=pp.x;cw.z=pp.z;
      cw.walk+=.22*dtF;const s=Math.sin(cw.walk*6);L[0].rotation.x=s*.6;L[1].rotation.x=-s*.6;}
    if(wanted>=2){cw.fireT-=dtF/60;if(cw.fireT<=0&&d<28){cw.fireT=.7;shoot(cw.x+Math.sin(ang)*1.4,1.4,cw.z+Math.cos(ang)*1.4,ang+rnd(-.07,.07),'cop',10);}}
    if(d<1.6&&Math.hypot(player.vx,player.vz)<.25&&!player.inCar){bustedNow();}
  }else{ // patrol wander
    if(Math.random()<.01)cw.wanderA+=rnd(-1,1);
    const pp={x:cw.x+Math.sin(cw.wanderA)*.03*dtF,z:cw.z+Math.cos(cw.wanderA)*.03*dtF,vx:0,vz:0};resolveCircle(pp,.5);cw.x=pp.x;cw.z=pp.z;m.rotation.y=cw.wanderA;
    cw.walk+=.05*dtF;const s=Math.sin(cw.walk*4)*.3;L[0].rotation.x=s;L[1].rotation.x=-s;L[2].rotation.set(0,0,0);L[3].rotation.set(0,0,0);
  }
  m.position.set(M.clamp(cw.x,-WORLD+2,WORLD-2),0,M.clamp(cw.z,-WORLD+2,WORLD-2));cw.x=m.position.x;cw.z=m.position.z;
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
  for(const c of cops)m=Math.min(m,pdist(c.mesh.position.x,c.mesh.position.z));
  for(const f of footCops)m=Math.min(m,pdist(f.mesh.position.x,f.mesh.position.z));
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
// roof height of a vehicle by type (for jumping on top of cars)
function carTop(m){const t=m.userData.type;return t==='bike'?1.05:t==='auto'?1.7:1.95;}
// support height under the on-foot player: terrain/ramps/decks + roofs of cars & props you can stand on
function footSupport(x,z,curY){
  if(curY===undefined)curY=player.y;
  let h=groundHeightAt(x,z,curY+0.6),car=null;
  const onCar=(m)=>{if(m.userData.dead)return;const top=m.position.y+carTop(m);
    if(Math.abs(x-m.position.x)<1.5&&Math.abs(z-m.position.z)<2.5&&top>h&&curY>=top-.55){h=top;car=m;}};
  for(const a of aiCars)onCar(a.mesh);
  for(const c of cops)onCar(c.mesh);
  for(const v of parked)onCar(v);
  for(const pr of dynProps)if(!pr.dead){const top=pr.restY+pr.rad;
    if(Math.abs(x-pr.x)<pr.rad+.35&&Math.abs(z-pr.z)<pr.rad+.35&&top>h&&player.y>=top-.4)h=top;}
  return {h,car};
}
// melee: punch (fists) or stab (knife) in a forward arc; staggers/wounds/kills targets
function meleeAttack(){
  const w=owned[curW],spec=w==='knife'?WEAPONS.knife:{rate:.45,dmg:20,reach:1.8};
  meleeT=spec.rate;player.meleeAnim=.25;crashSound(.14);
  const aim=player.heading+camYaw,reach=spec.reach,dmg=spec.dmg,kb=w==='knife'?.3:.5;
  const inArc=(tx,tz)=>{const dx=tx-player.x,dz=tz-player.z,d=Math.hypot(dx,dz);
    if(d>reach)return false;let da=Math.atan2(dx,dz)-aim;while(da>Math.PI)da-=6.283;while(da<-Math.PI)da+=6.283;return Math.abs(da)<.95;};
  for(const p of peds){if(p.state==='down')continue;
    if(inArc(p.x,p.z)){p.x+=Math.sin(aim)*kb;p.z+=Math.cos(aim)*kb;p.hp-=dmg;
      if(p.hp<=0)downPed(p);else woundPed(p);
      if(crimeCool<=0){addWanted(1);crimeCool=2;}break;}}
  for(const g of gangs){if(g.state==='dead')continue;
    if(inArc(g.x,g.z)){g.x+=Math.sin(aim)*kb*.6;g.z+=Math.cos(aim)*kb*.6;g.hp-=dmg;
      if(g.hp<=0)killGang(g);else{provokeGang(g);if(g.hp<60)g.wound=true;}break;}}
}

// ---------- particles ----------
const parts=[];
const partGeo=new THREE.SphereGeometry(1,6,5);
// opts: {grav, drag(horiz damp/frame), grow(scale/frame, <1 shrinks), bounce(restitution 0..1)}
function spawnP(x,y,z,color,size,life,vx,vy,vz,o){
  if(parts.length>180)return;o=o||{};
  const m=new THREE.Mesh(partGeo,new THREE.MeshBasicMaterial({color,transparent:true}));
  m.position.set(x,y,z);m.scale.setScalar(size);
  parts.push({m,vx,vy,vz,life,max:life,
    grav:o.grav==null?.012:o.grav, drag:o.drag==null?1:o.drag,
    grow:o.grow==null?1.02:o.grow, bounce:o.bounce==null?0:o.bounce});
  scene.add(m);
}
// sparks: shoot out, bounce off the ground, shrink and burn out fast
function sparks(p){for(let i=0;i<7;i++)spawnP(p.x,1,p.z,pick([0xffd23e,0xffae00,0xfff1b0]),rnd(.1,.18),rnd(.3,.5),rnd(-.45,.45),rnd(.15,.5),rnd(-.45,.45),{grow:.93,bounce:.38,drag:.82,grav:.022});}
// blood: heavier droplets that splat and settle on the ground
function spawnBlood(p){for(let i=0;i<7;i++)spawnP(p.x,.4,p.z,pick([0x991111,0x7a0d0d,0xb01a1a]),rnd(.14,.24),rnd(.7,1.0),rnd(-.2,.2),rnd(.05,.3),rnd(-.2,.2),{grow:.97,bounce:.14,drag:.74,grav:.024});}
// dismemberment: gore fountain + a real head mesh that flies off, tumbles and lands
const flyHeads=[];
function decapFx(x,z,skinHex){
  for(let i=0;i<16;i++)spawnP(x,1.7,z,pick([0x8a0f0f,0xb01515,0x6e0a0a]),rnd(.14,.3),rnd(.5,1.0),rnd(-.4,.4),rnd(.3,.7),rnd(-.4,.4),{grow:.96,bounce:.16,drag:.78,grav:.024});
  const head=new THREE.Group();
  const sk=new THREE.Mesh(headGeo,new THREE.MeshStandardMaterial({color:skinHex||0xd9a173,roughness:.8,metalness:.05}));
  const hr=new THREE.Mesh(hairGeo,new THREE.MeshStandardMaterial({color:0x2b1b0e,roughness:.9}));hr.position.y=.05;
  head.add(sk,hr);head.position.set(x,1.75,z);head.castShadow=true;scene.add(head);
  const dir=rnd(0,7);
  flyHeads.push({m:head,vx:Math.sin(dir)*.18,vz:Math.cos(dir)*.18,vy:.32,
    ax:rnd(-.4,.4),az:rnd(-.4,.4),life:5,rest:.16});
  crashSound(.4);
}
function updateFlyHeads(dtF,dt){
  for(let i=flyHeads.length-1;i>=0;i--){const h=flyHeads[i];h.life-=dt;
    if(h.life<=0){scene.remove(h.m);flyHeads.splice(i,1);continue;}
    h.vy-=.03*dtF;h.m.position.x+=h.vx*dtF;h.m.position.y+=h.vy*dtF;h.m.position.z+=h.vz*dtF;
    if(h.m.position.y<=h.rest){h.m.position.y=h.rest;if(h.vy<-.04)h.vy*=-.4;else h.vy=0;h.vx*=Math.pow(.8,dtF);h.vz*=Math.pow(.8,dtF);}
    h.m.rotation.x+=h.ax*dtF;h.m.rotation.z+=h.az*dtF;}
}
function explode(p){
  // billowing fireball: dark smoke grows & rises, bright embers fall and bounce
  for(let i=0;i<16;i++)spawnP(p.x,1.5,p.z,pick([0x333333,0x555555,0x222222]),rnd(.7,1.6),rnd(1.0,1.8),rnd(-.4,.4),rnd(.25,.6),rnd(-.4,.4),{grow:1.035,drag:.92,grav:-.006});   // hot smoke rises
  for(let i=0;i<14;i++)spawnP(p.x,1.5,p.z,pick([0xff6a00,0xffae00,0xff2200,0xfff1b0]),rnd(.3,.8),rnd(.6,1.1),rnd(-.7,.7),rnd(.3,.9),rnd(-.7,.7),{grow:.95,bounce:.3,drag:.85,grav:.02});
  const l=new THREE.PointLight(0xff8800,6,60);l.position.set(p.x,4,p.z);scene.add(l);
  setTimeout(()=>scene.remove(l),350);crashSound(1);addShake(1.1);
}
// ---------- tyre-skid decals (pooled flat ground quads laid down while drifting/handbraking) ----------
const skids=[],SKIDMAX=100;
const skidGeo=new THREE.PlaneGeometry(.34,.72);
function dropSkid(x,z,head){
  let m;
  if(skids.length>=SKIDMAX)m=skids.shift();                       // recycle the oldest mark
  else{m=new THREE.Mesh(skidGeo,new THREE.MeshBasicMaterial({color:0x0a0a0a,transparent:true,depthWrite:false}));scene.add(m);}
  m.rotation.set(-Math.PI/2,0,-head);                             // lay flat, align length with travel
  m.position.set(x,groundHeightAt(x,z)+.02,z);
  m.material.opacity=.5;m.userData.life=7;skids.push(m);
}
function updateSkids(dt){
  for(let i=skids.length-1;i>=0;i--){const m=skids[i];m.userData.life-=dt;
    if(m.userData.life<=0){scene.remove(m);m.material.dispose();skids.splice(i,1);continue;}
    m.material.opacity=Math.min(.5,m.userData.life/7*.5);}        // fade out over its lifetime
}

// ---------- taxi career (replaces the old yellow-marker delivery mission) ----------
let taxiMarker=null;
(function(){
  taxiMarker=new THREE.Group();
  const ring=new THREE.Mesh(new THREE.CylinderGeometry(4,4,.8,24,1,true),
    new THREE.MeshBasicMaterial({color:0x39d98a,transparent:true,opacity:.7,side:THREE.DoubleSide}));ring.position.y=.6;
  const beam=new THREE.Mesh(new THREE.CylinderGeometry(1.1,1.1,70,12,1,true),
    new THREE.MeshBasicMaterial({color:0x39d98a,transparent:true,opacity:.2,side:THREE.DoubleSide}));beam.position.y=35;
  taxiMarker.add(ring,beam);taxiMarker.visible=false;scene.add(taxiMarker);
})();
const taxi={active:false,phase:'',pax:null,dest:null,traveled:0,lastX:0,lastZ:0,t:0,t2:0,route:[],outX:0,outZ:0,paidFare:0};
function nearestCoord(arr,v){let best=arr[0],bd=1e9;for(const c of arr){const d=Math.abs(c-v);if(d<bd){bd=d;best=c;}}return best;}
// L-shaped grid route for the live GPS line: down a road column, then across to the destination
function computeRoute(sx,sz,dx,dz){
  const vx=nearestCoord(cityX.map(l=>l.c),(sx+dx)/2);
  return [[sx,sz],[vx,sz],[vx,dz],[dx,dz]];
}
function startTaxiJob(){
  if(taxi.active||!player.inCar||!vehicle||!vehicle.userData.taxi){
    if(!taxi.active&&(!vehicle||!vehicle.userData.taxi))showMsg('Get in a TAXI to start fares');return;}
  let it,tries=0;do{it=pick(inters);tries++;}while(tries<40&&Math.hypot(it.x-vehicle.position.x,it.z-vehicle.position.z)<120);
  const px=vehicle.position.x+rnd(-5,5),pz=vehicle.position.z+rnd(9,15);
  const pax=buildCharacter(pick(SKINc),pick(SHIRTc),pick(PANTSc),pick(HAIRc),false);
  scene.add(pax);pax.position.set(px,0,pz);pose(pax,false);
  Object.assign(taxi,{active:true,phase:'toCar',pax,dest:{x:it.x,z:it.z},traveled:0,t:0,t2:0,
    lastX:vehicle.position.x,lastZ:vehicle.position.z});
  taxiMarker.position.set(px,0,pz);taxiMarker.visible=true;
  showMsg('TAXI — pick up the passenger');chime();
}
function paxWalk(tx,tz,dtF,speed){
  const pax=taxi.pax,dx=tx-pax.position.x,dz=tz-pax.position.z,d=Math.hypot(dx,dz);
  if(d>.04){const ang=Math.atan2(dx,dz),step=Math.min(speed*dtF,d);
    const pp={x:pax.position.x+Math.sin(ang)*step,z:pax.position.z+Math.cos(ang)*step,vx:0,vz:0};
    resolveCircle(pp,.4);pax.position.x=pp.x;pax.position.z=pp.z;pax.rotation.y=ang;
    taxi.t2+=.2*dtF;const s=Math.sin(taxi.t2*6),L=pax.userData.limbs;
    L[0].rotation.x=s*.6;L[1].rotation.x=-s*.6;L[2].rotation.x=-s*.5;L[3].rotation.x=s*.5;}
  return d;
}
function taxiDoor(open,dtF){const dr=vehicle&&vehicle.userData.door;if(dr)dr.rotation.y+=((open?1.15:0)-dr.rotation.y)*.2*dtF;}
function endTaxiJob(){if(taxi.pax){if(taxi.pax.parent)taxi.pax.parent.remove(taxi.pax);taxi.pax=null;}
  taxi.active=false;taxi.phase='';taxiMarker.visible=false;}
// ---------- race mission logic (AI racers follow race.wp; player races for placement cash) ----------
const racers=[];const RACE_LAPS=2;
function startRace(){
  if(race.active)return;
  race.active=true;race.lap=0;race.pos=1;race.lastWp=0;race.t=0;
  const a0=race.wp[0],a1=race.wp[1];const dx=a1.x-a0.x,dz=a1.z-a0.z,L=Math.hypot(dx,dz)||1;const ux=dx/L,uz=dz/L,px=-uz,pz=ux;
  for(let i=0;i<3;i++){const m=makeCar(pick([0xff3030,0x30a0ff,0x30d060]),false,'race');
    m.position.set(a0.x-ux*(6+i*5)+px*(i%2?2.5:-2.5),0,a0.z-uz*(6+i*5)+pz*(i%2?2.5:-2.5));
    m.rotation.y=Math.atan2(ux,uz);racers.push({mesh:m,wpIdx:1,lap:0,spd:0});}
  showMsg('🏁 RACE! '+RACE_LAPS+' laps — beat the field!');
}
function endRace(place){
  race.active=false;for(const r of racers)scene.remove(r.mesh);racers.length=0;
  if(place!=null){const prize=place===1?8000:place===2?3000:place===3?1500:500;money+=prize;chime();showMsg('🏆 Finished P'+place+'  +'+prize);}
}
function raceUpdate(dt,dtF){
  if(!race.active)return;race.t+=dt;
  for(const r of racers){
    const tgt=race.wp[r.wpIdx],dx=tgt.x-r.mesh.position.x,dz=tgt.z-r.mesh.position.z,d=Math.hypot(dx,dz);
    let dh=Math.atan2(dx,dz)-r.mesh.rotation.y;while(dh>Math.PI)dh-=2*Math.PI;while(dh<-Math.PI)dh+=2*Math.PI;
    r.mesh.rotation.y+=dh*Math.min(1,.12*dtF);r.spd=Math.min(.92,r.spd+.02*dtF);
    const mv=r.spd*dtF;r.mesh.position.x+=Math.sin(r.mesh.rotation.y)*mv;r.mesh.position.z+=Math.cos(r.mesh.rotation.y)*mv;
    r.mesh.userData.wheels.forEach(w=>w.rotation.x+=r.spd*.6*dtF);
    if(d<7){r.wpIdx++;if(r.wpIdx>=race.wp.length){r.wpIdx=0;r.lap++;}}
  }
  const nx=race.wp[(race.lastWp+1)%race.wp.length];
  if(pdist(nx.x,nx.z)<10){race.lastWp=(race.lastWp+1)%race.wp.length;if(race.lastWp===0)race.lap++;}
  const pScore=race.lap*race.wp.length+race.lastWp;let ahead=0;
  for(const r of racers)if(r.lap*race.wp.length+r.wpIdx>pScore)ahead++;
  race.pos=ahead+1;
  if(race.lap>=RACE_LAPS)endRace(race.pos);
  else if(race.t>6&&!player.inCar&&pdist(race.cx,race.cz)>150){showMsg('Race abandoned');endRace(null);}   // grace period before abandon check
}
// ---------- courier mission: timed chain of package drop-offs for cash ----------
const courier={active:false,drops:0,total:4,time:0,dest:null,marker:null};
(function(){const g=new THREE.Group();
  const ring=new THREE.Mesh(new THREE.CylinderGeometry(4,4,.8,24,1,true),new THREE.MeshBasicMaterial({color:0xffa022,transparent:true,opacity:.75,side:THREE.DoubleSide}));ring.position.y=.6;
  const beam=new THREE.Mesh(new THREE.CylinderGeometry(1.1,1.1,70,12,1,true),new THREE.MeshBasicMaterial({color:0xffa022,transparent:true,opacity:.22,side:THREE.DoubleSide}));beam.position.y=35;
  g.add(ring,beam);g.visible=false;scene.add(g);courier.marker=g;})();
function courierDrop(){const it=pick(inters);courier.dest={x:it.x,z:it.z};courier.marker.position.set(it.x,0,it.z);courier.marker.visible=true;}
function startCourier(){
  if(courier.active)return;
  courier.active=true;courier.drops=0;courier.total=4;courier.time=50;courierDrop();chime();
  showMsg('📦 COURIER — '+courier.total+' drops, beat the clock!');
}
function endCourier(ok){
  courier.active=false;courier.marker.visible=false;
  if(ok){const prize=2000+courier.drops*800;money+=prize;chime();showMsg('📦 All delivered! +'+prize);}
  else showMsg('📦 Out of time — delivery failed');
}
function courierUpdate(dt){
  if(!courier.active)return;
  courier.time-=dt;courier.marker.rotation.y+=dt*1.5;
  if(courier.time<=0){endCourier(false);return;}
  if(courier.dest&&pdist(courier.dest.x,courier.dest.z)<6){
    courier.drops++;
    if(courier.drops>=courier.total)endCourier(true);
    else{courier.time+=12;courierDrop();chime();showMsg('Drop '+courier.drops+'/'+courier.total+' ✓  (+12s)');}
  }
}
function taxiUpdate(dt,dtF){
  if(!taxi.active)return;
  const v=vehicle;
  // abandoning the taxi before drop-off cancels the fare
  if((taxi.phase==='toCar'||taxi.phase==='boarding'||taxi.phase==='ride')&&(!v||!v.userData.taxi)){
    showMsg('TAXI — fare cancelled');endTaxiJob();return;}
  if(taxi.phase==='toCar'){
    const dw=v.localToWorld(new THREE.Vector3(-1.7,0,.2));
    const d=paxWalk(dw.x,dw.z,dtF,.13);
    taxiMarker.position.set(taxi.pax.position.x,0,taxi.pax.position.z);
    if(d<1.5){taxi.phase='boarding';taxi.t=0;}
  }else if(taxi.phase==='boarding'){
    taxiDoor(true,dtF);taxi.t+=dt;
    const seat=v.localToWorld(new THREE.Vector3(.45,.2,-.2));      // slide into the seat
    taxi.pax.position.x+=(seat.x-taxi.pax.position.x)*.22*dtF;
    taxi.pax.position.z+=(seat.z-taxi.pax.position.z)*.22*dtF;taxi.pax.position.y=.2;
    if(taxi.t>1.3){                                               // seated → close door, begin ride
      v.add(taxi.pax);taxi.pax.position.set(.45,.18,-.2);taxi.pax.rotation.set(0,0,0);taxi.pax.scale.setScalar(.82);pose(taxi.pax,true);
      taxi.phase='ride';taxi.t=0;taxiMarker.position.set(taxi.dest.x,0,taxi.dest.z);
      showMsg('TAXI — drive to the destination');
    }
  }else if(taxi.phase==='ride'){
    taxiDoor(false,dtF);
    taxi.traveled+=Math.hypot(v.position.x-taxi.lastX,v.position.z-taxi.lastZ);
    taxi.lastX=v.position.x;taxi.lastZ=v.position.z;
    taxi.route=computeRoute(v.position.x,v.position.z,taxi.dest.x,taxi.dest.z);    // live GPS
    if(Math.hypot(v.position.x-taxi.dest.x,v.position.z-taxi.dest.z)<7&&Math.hypot(player.vx,player.vz)<.25){
      taxi.phase='dropoff';taxi.t=0;taxi.route=[];
      const out=v.localToWorld(new THREE.Vector3(-2.5,0,.2));scene.add(taxi.pax);
      taxi.pax.position.set(v.position.x-1.6,0,v.position.z);taxi.pax.scale.setScalar(1);pose(taxi.pax,false);
      taxi.outX=out.x;taxi.outZ=out.z;
    }
  }else if(taxi.phase==='dropoff'){
    taxiDoor(true,dtF);taxi.t+=dt;
    const d=paxWalk(taxi.outX,taxi.outZ,dtF,.1);
    if(taxi.t>1.3&&d<.5){                                         // EXIT complete → pay the fare now
      taxi.phase='leaving';taxi.t=0;
      const fare=Math.round(25+taxi.traveled*1.4);money+=fare;taxi.paidFare=fare;
      chime();showMsg('FARE PAID  +$'+fare);
    }
  }else if(taxi.phase==='leaving'){
    taxiDoor(false,dtF);taxi.t+=dt;
    const ang=taxi.pax.rotation.y;taxi.pax.position.x+=Math.sin(ang)*.08*dtF;taxi.pax.position.z+=Math.cos(ang)*.08*dtF;
    taxi.t2+=.2*dtF;const s=Math.sin(taxi.t2*6),L=taxi.pax.userData.limbs;L[0].rotation.x=s*.6;L[1].rotation.x=-s*.6;
    if(taxi.t>2.0)endTaxiJob();
  }
}
function showMsg(t){
  const el=document.getElementById('msg');el.textContent=t;el.style.opacity=1;
  clearTimeout(el._t);el._t=setTimeout(()=>el.style.opacity=0,3200);
}
// onboarding: when no mission is running, the objective line always tells a new player what to do next
function onboardHint(){
  if(!player.inCar)return '🚗 Walk up to a car and press E to drive';
  const d=Math.round(pdist(race.cx,race.cz));
  return '🏁 Drive to the white ring ('+d+'m) to race — or type a cheat: VIGI · COURIER · TOOLED';
}

// ---------- death / arrest ----------
function damageVehicle(n){
  if(!vehicle||vehicle.userData.dead)return;
  n*=0.4;                                       // health depletes slowly — softer damage across the board
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
  player.x=spawnX+5;player.z=spawnZ-4;player.vx=player.vz=0;player.vy=0;player.y=0;player.climbV=0;player.airborne=false;player.heading=Math.PI/2;
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
  }else if(v.userData.type==='plane'){ // seated in the cockpit
    v.add(char);
    char.position.set(0,1.2,.9);char.rotation.set(0,0,0);char.scale.setScalar(.8);
    pose(char,true);char.visible=true;
    v.userData.thr=0;v.userData.spd=0;camPitch=0;camYaw=0;            // neutral, level start
    showMsg('✈ Mouse = steer · mouse up/down = climb/dive · W = throttle · S = brake · A/D = roll');
  }else if(v.userData.type==='heli'){ // seated in the cockpit
    v.add(char);
    char.position.set(0,1.55,.4);char.rotation.set(0,0,0);char.scale.setScalar(.8);
    pose(char,true);char.visible=true;
    v.userData.spin=0;v.userData.spd=0;camYaw=0;
    showMsg('🚁 Arrows = up/down · W/S = forward/back · A/D = turn');
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
  const isPolice=!!(near.userData&&near.userData.beacons);
  if(ai){
    const i=aiCars.indexOf(ai);if(i>=0)aiCars.splice(i,1);
    spawnAI(near.userData.type==='bike');
  }
  if(isPolice){addWanted(2);showMsg('POLICE CRUISER STOLEN!');}   // stealing any cruiser = 2 stars
  else if(ai){showMsg('CARJACKED!');if(policeNear(70))addWanted(1);}
  const pIdx=parked.indexOf(near);if(pIdx>=0)parked.splice(pIdx,1);
  vehicle=near;player.inCar=true;
  player.x=near.position.x;player.z=near.position.z;
  player.heading=near.rotation.y;player.vx=player.vz=0;player.vy=0;player.climbV=0;player.y=near.position.y||0;player.airborne=false;
  mountChar(near);exitCool=.6;jack=null;
}
function abortJack(){if(jack&&jack.ai)jack.ai.jacked=false;jack=null;if(char.parent!==scene){scene.add(char);char.scale.setScalar(1);}char.visible=true;}
function jackUpdate(dt,dtF){
  const v=jack.veh,bike=v.userData.type==='bike';
  if(!v||v.userData.dead){abortJack();return;}                 // target gone/destroyed → release control
  jack.life=(jack.life||0)+dt;if(jack.life>8){abortJack();return;}   // watchdog: never leave the player frozen mid-jack
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
    const aircraft=vehicle&&(vehicle.userData.type==='heli'||vehicle.userData.type==='plane');
    const airborne=aircraft&&player.y>2.5;   // can't step out of a flying aircraft — land first
    if(airborne){prompt.innerHTML='Land before exiting';prompt.style.opacity=1;}
    else if(Math.hypot(player.vx,player.vz)<.15){prompt.innerHTML='Press <b>E</b> to get out';prompt.style.opacity=1;}
    else prompt.style.opacity=0;
    if(pressedE&&exitCool<=0&&!airborne&&Math.hypot(player.vx,player.vz)<.3){
      exitCool=.6;player.inCar=false;
      const fx=Math.sin(player.heading),fz=Math.cos(player.heading);
      const veh=vehicle;
      player.x=veh.position.x-fz*2.6;player.z=veh.position.z+fx*2.6;
      player.vx=player.vz=0;player.vy=0;player.climbV=0;player.airborne=false;player._rx=undefined;
      // stand on whatever is actually under us (deck/ramp/ground) — forcing y=0 dropped you under raised roads
      player.y=footSupport(player.x,player.z,veh.position.y||0).h;
      if(!parked.includes(veh))parked.push(veh);
      dismountChar();openDoor(veh,perf+.8);vehicle=null;
    }
  }else{
    const near=nearestEnterable();
    if(near){
      const t0=near.userData.type;const what=t0==='bike'?'bike':t0==='auto'?'auto':t0==='plane'?'plane':t0==='heli'?'helicopter':'car';
      prompt.innerHTML='Press <b>E</b> to '+(parked.includes(near)?'ride this '+what:'<b>steal</b> this '+what);
      prompt.style.opacity=1;
    }else prompt.style.opacity=0;
    if(pressedE&&exitCool<=0&&near){exitCool=.6;startJack(near);}
  }
  pressedE=false;
}
// arcade flight model: W/S throttle, A/D rudder+bank, Space climb, Shift dive. Needs takeoff speed to leave the ground.
// MOUSE flies the plane: the nose follows where the camera looks (yaw) and the mouse pitch climbs/dives.
// W/S = throttle, A/D = roll + rudder assist. Needs takeoff airspeed before it leaves the ground.
function planeUpdate(k,dt,dtF){
  const v=vehicle,ud=v.userData;
  ud.thr=M.clamp((ud.thr||0)+((k.up?1:0)-(k.dn?1:0))*.7*dt,0,1);
  ud.spd=M.lerp(ud.spd||0,ud.thr*2.4,.012*dtF);            // airspeed eases toward the throttle setting
  const onGround=player.y<=.06,canFly=ud.spd>1.0;
  // --- steer with the mouse: turn the nose toward the camera's look direction (yaw) ---
  const worldAim=player.heading+camYaw;
  let dh=worldAim-player.heading;while(dh>Math.PI)dh-=2*Math.PI;while(dh<-Math.PI)dh+=2*Math.PI;
  const aRud=(k.lf?1:0)-(k.rt?1:0);                        // A/D add rudder/roll on top of the mouse
  player.heading+=(dh*.9+aRud*.5)*(onGround?.04:.05)*Math.min(1,ud.spd/.4)*dtF;
  camYaw=worldAim-player.heading;                          // camera holds its world direction; the plane turns under it
  const pitchCmd=canFly?M.clamp(-camPitch,-1.0,1.0):0;     // mouse up (camPitch<0) = climb, down = dive
  // --- vertical flight: elevation tracks the MOUSE up/down directly (steep, not speed-bound) ---
  if(canFly){
    player.vy=M.lerp(player.vy,pitchCmd*20,.07*dtF);       // climb/dive rate follows the mouse pitch
  }else player.vy-=14*dt;                                  // too slow: sink/stall
  player.vy=M.clamp(player.vy,-22,18);
  player.y+=player.vy*dt;
  if(player.y<=0){if(player.vy<-6){damageVehicle(-player.vy*1.6);crashSound(.6);}player.y=0;player.vy=0;}
  player.y=M.clamp(player.y,0,160);
  // --- horizontal motion along the heading ---
  const nfx=Math.sin(player.heading),nfz=Math.cos(player.heading);
  player.vx=nfx*ud.spd;player.vz=nfz*ud.spd;
  let nx=v.position.x+player.vx*dtF,nz=v.position.z+player.vz*dtF;
  if(player.y<22){const pp={x:nx,z:nz,vx:player.vx,vz:player.vz};const imp=resolveCircle(pp,ud.rad);
    nx=pp.x;nz=pp.z;if(imp>.4){ud.spd*=.6;damageVehicle(imp*22);crashSound(imp);}}
  nx=M.clamp(nx,-WORLD+6,WORLD-6);nz=M.clamp(nz,-WORLD+6,WORLD-6);
  v.position.set(nx,player.y,nz);player.x=nx;player.z=nz;
  // --- visuals: bank into the turn, pitch with the climb rate ---
  ud.roll=M.lerp(ud.roll||0,onGround?0:M.clamp(-(dh*1.2+aRud*.5),-.7,.7),.08*dtF);
  ud.pitch=M.lerp(ud.pitch||0,M.clamp(-player.vy*.05,-.5,.5),.1*dtF);
  v.rotation.set(ud.pitch,player.heading,ud.roll);
  if(ud.prop)ud.prop.rotation.z+=(.3+ud.thr*2.6)*dtF;
}

// helicopter flight model: ARROW Up/Down = climb/descend, W/S = forward/back, A/D = yaw (turn). Mouse also yaws.
function heliUpdate(k,dt,dtF){
  const v=vehicle,ud=v.userData;
  ud.spin=M.clamp((ud.spin||0)+dt*0.5,0,1);               // rotor spins up to full power
  const lift=ud.spin;
  // --- vertical: arrow keys command climb/descend, scaled by rotor power ---
  const climb=(keys.ArrowUp?1:0)-(keys.ArrowDown?1:0);
  player.vy=M.lerp(player.vy,(climb*11 - (lift<.98?2.2:0))*lift,.09*dtF);
  player.vy=M.clamp(player.vy,-13,13);
  player.y+=player.vy*dt;
  if(player.y<=0){if(player.vy<-6){damageVehicle(-player.vy*1.4);crashSound(.5);}player.y=0;player.vy=0;}
  player.y=M.clamp(player.y,0,180);
  // --- yaw: A/D rudder + the mouse look direction ---
  const worldAim=player.heading+camYaw;
  let dh=worldAim-player.heading;while(dh>Math.PI)dh-=2*Math.PI;while(dh<-Math.PI)dh+=2*Math.PI;
  const yawIn=(keys.KeyA?1:0)-(keys.KeyD?1:0);
  player.heading+=(dh*.06+yawIn*.035)*dtF;
  camYaw=worldAim-player.heading;
  // --- horizontal: W/S thrust along the heading ---
  const fwd=(keys.KeyW?1:0)-(keys.KeyS?1:0);
  ud.spd=M.lerp(ud.spd||0,fwd*1.7*lift,.04*dtF);
  const nfx=Math.sin(player.heading),nfz=Math.cos(player.heading);
  player.vx=nfx*ud.spd;player.vz=nfz*ud.spd;
  let nx=v.position.x+player.vx*dtF,nz=v.position.z+player.vz*dtF;
  // chopper flies freely above rooftops — only bump buildings while taxiing very low (<4u); otherwise no air collision
  if(player.y<4){const pp={x:nx,z:nz,vx:player.vx,vz:player.vz};const imp=resolveCircle(pp,ud.rad);
    nx=pp.x;nz=pp.z;if(imp>.4){ud.spd*=.5;damageVehicle(imp*16);crashSound(imp);}}
  nx=M.clamp(nx,-WORLD+6,WORLD-6);nz=M.clamp(nz,-WORLD+6,WORLD-6);
  v.position.set(nx,player.y,nz);player.x=nx;player.z=nz;
  // --- visuals: nose-down when moving forward, bank into the yaw, spin the rotors ---
  ud.roll=M.lerp(ud.roll||0,M.clamp(yawIn*.22,-.4,.4),.08*dtF);
  ud.pitch=M.lerp(ud.pitch||0,M.clamp(ud.spd*.22,-.35,.35),.1*dtF);
  v.rotation.set(ud.pitch,player.heading,ud.roll);
  if(ud.rotor)ud.rotor.rotation.y+=(.4+lift*3.4)*dtF;
  if(ud.trotor)ud.trotor.rotation.x+=(.5+lift*4)*dtF;
}

// ---------- minimap ----------
const mm=document.getElementById('minimap').getContext('2d');
const ms=720/(WORLD*2);
function drawBlip(x,z,color,r){
  mm.fillStyle=color;mm.beginPath();
  mm.arc((x+WORLD)*ms,(z+WORLD)*ms,r/1.15,0,7);mm.fill();
}
// labelled map symbols (used by both the minimap and the full map)
const LM_COL={hospital:'#e74c3c',police:'#2e6fff',food:'#e67e22',airport:'#16a596'};
function drawMapIcon(g,x,y,r,type){
  g.fillStyle=LM_COL[type]||'#888';g.strokeStyle='rgba(0,0,0,.75)';g.lineWidth=r*.2;
  g.beginPath();g.arc(x,y,r,0,7);g.fill();g.stroke();
  g.strokeStyle='#fff';g.fillStyle='#fff';g.lineCap='round';g.lineJoin='round';g.lineWidth=Math.max(1.3,r*.24);
  if(type==='hospital'){const a=r*.5;g.beginPath();g.moveTo(x-a,y);g.lineTo(x+a,y);g.moveTo(x,y-a);g.lineTo(x,y+a);g.stroke();}
  else if(type==='police'){g.beginPath();for(let i=0;i<10;i++){const ang=-Math.PI/2+i*Math.PI/5,rad=i%2?r*.28:r*.58;i?g.lineTo(x+Math.cos(ang)*rad,y+Math.sin(ang)*rad):g.moveTo(x+Math.cos(ang)*rad,y+Math.sin(ang)*rad);}g.closePath();g.fill();}
  else if(type==='food'){const a=r*.55;g.beginPath();
    g.moveTo(x-r*.28,y-a);g.lineTo(x-r*.28,y+a);g.moveTo(x-r*.5,y-a);g.lineTo(x-r*.5,y-a*.1);g.moveTo(x-r*.06,y-a);g.lineTo(x-r*.06,y-a*.1);
    g.moveTo(x+r*.34,y-a);g.lineTo(x+r*.34,y+a);g.stroke();}
  else if(type==='airport'){g.beginPath();
    g.moveTo(x,y-r*.6);g.lineTo(x,y+r*.55);
    g.moveTo(x,y-r*.05);g.lineTo(x-r*.6,y+r*.22);g.moveTo(x,y-r*.05);g.lineTo(x+r*.6,y+r*.22);
    g.moveTo(x,y+r*.4);g.lineTo(x-r*.26,y+r*.6);g.moveTo(x,y+r*.4);g.lineTo(x+r*.26,y+r*.6);g.stroke();}
}
let healCool=0,insideLM=null,shake=0;
function addShake(a){shake=Math.min(1.3,shake+a);}   // decaying camera kick on impacts
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
  if(taxi.active){
    if(taxi.route&&taxi.route.length>1){mm.strokeStyle='#39d98a';mm.lineWidth=2.6;mm.lineJoin='round';mm.beginPath();
      mm.moveTo((taxi.route[0][0]+WORLD)*ms,(taxi.route[0][1]+WORLD)*ms);
      for(let i=1;i<taxi.route.length;i++)mm.lineTo((taxi.route[i][0]+WORLD)*ms,(taxi.route[i][1]+WORLD)*ms);mm.stroke();}
    drawBlip(taxiMarker.position.x,taxiMarker.position.z,'#39d98a',6);
  }
  drawBlip(race.cx,race.cz,'#ffffff',7);drawBlip(race.cx,race.cz,'#111111',3);   // checkered race-circuit marker
  for(const c of cops)drawBlip(c.mesh.position.x,c.mesh.position.z,'#ff3b30',5);
  for(const f of footCops)drawBlip(f.mesh.position.x,f.mesh.position.z,'#ff3b30',3.4);
  for(const g of gangs)if(g.state!=='dead')drawBlip(g.x,g.z,g.state==='aggro'?'#ff6a00':'#b8439b',3.6);
  for(const a of aiCars)if(a.police)drawBlip(a.mesh.position.x,a.mesh.position.z,'#2e6fff',4.2);
  for(const cw of copWalkers)drawBlip(cw.x,cw.z,'#2e6fff',3);
  for(const g of pickups)drawBlip(g.position.x,g.position.z,'#2ecc71',3.6);
  const upr=Math.PI-player.heading;   // counter the map's rotation so the symbols stay upright
  const lmMM=(wx,wz,type)=>{mm.save();mm.translate((wx+WORLD)*ms,(wz+WORLD)*ms);mm.rotate(upr);drawMapIcon(mm,0,0,7,type);mm.restore();};
  for(const Lm of landmarks)lmMM(Lm.x,Lm.z,Lm.type);
  if(airport)lmMM(airport.cx,airport.cz,'airport');
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
    if(taxi.active){g.strokeStyle='#39d98a';g.lineWidth=3;g.lineJoin='round';const R=taxi.route||[];
      if(R.length>1){g.beginPath();g.moveTo((R[0][0]+WORLD)*k,(R[0][1]+WORLD)*k);for(let i=1;i<R.length;i++)g.lineTo((R[i][0]+WORLD)*k,(R[i][1]+WORLD)*k);g.stroke();}
      g.fillStyle='#39d98a';g.beginPath();g.arc((taxiMarker.position.x+WORLD)*k,(taxiMarker.position.z+WORLD)*k,8,0,7);g.fill();}
    g.fillStyle='#2ecc71';
    for(const p of pickups){g.beginPath();g.arc((p.position.x+WORLD)*k,(p.position.z+WORLD)*k,4,0,7);g.fill();}
    // labelled landmark + airport symbols (north-up, so text is readable)
    const lmR=Math.max(9,sz*.015);g.textAlign='center';g.textBaseline='middle';g.font='bold '+Math.round(lmR*1.05)+'px Arial';
    const lmBig=(wx,wz,type,label)=>{const sx=(wx+WORLD)*k,sy=(wz+WORLD)*k;drawMapIcon(g,sx,sy,lmR,type);
      g.lineWidth=3;g.strokeStyle='#000';g.fillStyle='#fff';g.strokeText(label,sx,sy+lmR*2);g.fillText(label,sx,sy+lmR*2);};
    for(const Lm of landmarks)lmBig(Lm.x,Lm.z,Lm.type,Lm.name);
    if(airport)lmBig(airport.cx,airport.cz,'airport','AIRPORT');
    g.textBaseline='alphabetic';
    g.fillStyle='#fff';g.strokeStyle='#000';g.lineWidth=2;
    g.save();g.translate((player.x+WORLD)*k,(player.z+WORLD)*k);g.rotate(Math.PI-player.heading);
    g.beginPath();g.moveTo(0,-9);g.lineTo(6,7);g.lineTo(0,3);g.lineTo(-6,7);g.closePath();g.fill();g.stroke();g.restore();
  }
}

// ---------- zones ----------
function zoneName(){
  if(airport&&player.x>airport.x0&&player.x<airport.x1&&player.z>airport.z0&&player.z<airport.z1)return 'Indira Gandhi Airport';
  if(river&&Math.abs(player.x-river.cx)<river.half+9)return 'Yamuna Riverfront';
  for(const Lm of landmarks)if(Math.abs(player.x-Lm.x)<Lm.hw&&Math.abs(player.z-Lm.z)<Lm.hd)return Lm.name;
  for(const b of blocks)if(b.park&&player.x>b.x0-12&&player.x<b.x1+12&&player.z>b.z0-12&&player.z<b.z1+12)return 'Nehru Park';
  const d=pdist(spawnX,spawnZ);
  return d<140?'Connaught Place':d<280?'Bazaar District':'City Outskirts';
}

// ---------- main loop ----------
const clock=new THREE.Clock();
let perf=0,frame=0,curZone='',fireT=0,fpsEMA=60;
// ---------- pause ----------
let paused=false;
function setPaused(v){
  paused=v;document.getElementById('pause').style.display=v?'flex':'none';
  if(v){if(document.exitPointerLock)document.exitPointerLock();}
  else{clock.getDelta();const c=document.getElementById('c');if(c.requestPointerLock)c.requestPointerLock();}   // discard the long paused delta so the sim doesn't jump
}
document.addEventListener('pointerlockchange',()=>{
  if(!document.pointerLockElement&&started&&!bigOpen&&!paused&&!dead)setPaused(true);   // Esc / focus loss → pause
});
if(DEBUG)window.__pause=v=>setPaused(v);   // test hook (headless never acquires pointer lock)
{const $=id=>document.getElementById(id);
 $('pResume').addEventListener('click',()=>setPaused(false));
 $('pSettings').addEventListener('click',()=>{$('pause').style.display='none';window.__openSettings('pause');});
 $('pQuit').addEventListener('click',()=>{paused=false;$('pause').style.display='none';started=false;$('intro').style.display='flex';if(hasSave())$('mContinue').disabled=false;});}
const skyDay=new THREE.Color(0x87ceeb),skyNight=new THREE.Color(0x0b1026),skySet=new THREE.Color(0xff8c5a);
const skyTopDay=new THREE.Color(0x2f6fb0),skyTopNight=new THREE.Color(0x04060d);
const skyCol=new THREE.Color(),skyTopCol=new THREE.Color(),_sunDir=new THREE.Vector3();
weaponHUD();

function animate(){
  requestAnimationFrame(animate);
  const dt=Math.min(clock.getDelta(),.05),dtF=dt*60;
  perf+=dt;frame++;if(dt>0)fpsEMA=fpsEMA*.93+(1/dt)*.07;   // smoothed FPS for the perf probe
  if(!started||bigOpen||paused){renderFrame();return;}
  const k=inp();
  lightT+=dt;tod=(tod+dt/480)%1;

  // --- player ---
  if(!dead){
    if(player.inCar&&(!vehicle||vehicle.userData.dead)){player.inCar=false;vehicle=null;}   // orphaned in-car flag → drop back to on foot
    if(!player.inCar&&!jack&&char.parent!==scene){scene.add(char);char.scale.setScalar(1);char.visible=true;}   // hard safety: on foot the avatar is ALWAYS in the scene & visible
    {const sig=money+'|'+owned.join(',')+'|'+JSON.stringify(ammo);if(sig!==saveSig){saveSig=sig;saveProgress({money,owned:owned.slice(),ammo:Object.assign({},ammo)});}}   // progression auto-save: only on change (debounced ~1s in core/save.js)
    if(player.inCar&&vehicle&&vehicle.userData.type==='plane'){
      planeUpdate(k,dt,dtF);
    }else if(player.inCar&&vehicle&&vehicle.userData.type==='heli'){
      heliUpdate(k,dt,dtF);
    }else if(player.inCar&&vehicle){
      const bike=vehicle.userData.type==='bike';
      const fx=Math.sin(player.heading),fz=Math.cos(player.heading);
      let vf=player.vx*fx+player.vz*fz, vl=player.vx*fz-player.vz*fx;
      const H=HANDLING[vehicle.userData.cls]||HANDLING.sedan;   // per-vehicle accel/top/turn/grip
      const boost=k.boost&&vf>.1;
      if(k.up)vf+=H.accel*(boost?1.85:1)*dtF;
      if(k.dn)vf-=(vf>.05?.035:.013)*dtF;
      vf*=Math.pow(.992,dtF);
      if(!k.up&&!k.dn)vf*=Math.pow(.985,dtF);
      vf=M.clamp(vf,-.4,H.top*(boost?1.35:1));
      const steerIn=(k.lf?1:0)-(k.rt?1:0);
      player.steer+=(steerIn-player.steer)*.25*dtF;
      const spd=Math.abs(vf);
      // speed-sensitive grip: whipping the wheel at speed breaks rear traction → progressive drift.
      // grip closer to 1 = more lateral velocity retained = more slide.
      const slide=Math.abs(player.steer)*Math.min(1,spd/.7);
      const grip=k.hb?.965:M.lerp(H.gripLo,H.gripHi,slide);
      player.heading+=player.steer*(k.hb?.055:H.turn)*Math.sign(vf)*Math.min(1,spd/.5)*dtF;
      if(k.hb)vf*=Math.pow(.985,dtF);
      vl*=Math.pow(grip,dtF);
      const nfx=Math.sin(player.heading),nfz=Math.cos(player.heading);
      player.vx=nfx*vf+nfz*vl;player.vz=nfz*vf-nfx*vl;
      if(inRiver(vehicle.position.x,vehicle.position.z))player.vz+=river.flow*river.flowSpeed*dtF; // current carries you
      const rad=vehicle.userData.rad;
      const pp={x:vehicle.position.x+player.vx*dtF,z:vehicle.position.z+player.vz*dtF,vx:player.vx,vz:player.vz};
      const imp=(player.airborne||player.y>3)?0:resolveCircle(pp,rad);  // no ground collisions while airborne or up on the flyover/ramp
      player.vx=pp.vx;player.vz=pp.vz;
      pp.x=M.clamp(pp.x,-WORLD+4,WORLD-4);pp.z=M.clamp(pp.z,-WORLD+4,WORLD-4);
      // --- vertical: climb ramps gradually, launch off the lip, fall under gravity ---
      // reachability gate (groundHeightAt with maxReach) means a deck overhead can never yank you skyward.
      let landImpact=0;
      if(!player.airborne){
        const surf=groundHeightAt(pp.x,pp.z,player.y+0.7);
        if(surf>player.y+0.001){player.climbV=M.clamp((surf-player.y)/Math.max(dt,.016),0,16);player.y=surf;player.vy=0;}
        else if(surf<player.y-0.06){player.vy=player.climbV||0;player.airborne=true;player.climbV=0;}  // left the lip → launch
        else{player.y=surf;player.vy=0;player.climbV=0;}
      }
      if(player.airborne){
        player.vy=Math.max(player.vy-26*dt,-45);player.y+=player.vy*dt;
        const land=groundHeightAt(pp.x,pp.z,player.y+0.7);
        if(player.y<=land){landImpact=player.vy;player.y=land;player.vy=0;player.airborne=false;player.climbV=0;}
      }
      if(!isFinite(player.y)){player.y=0;player.vy=0;player.airborne=false;player.climbV=0;}  // hard NaN guard
      player.y=M.clamp(player.y,0,40);
      vehicle.position.set(pp.x,player.y,pp.z);
      vehicle.rotation.y=player.heading;
      player.x=pp.x;player.z=pp.z;
      if(imp>.15){damageVehicle(imp*26);crashSound(imp);sparks(vehicle.position);addShake(Math.min(1,imp*.9));}
      if(landImpact<-6){damageVehicle(Math.min(18,-landImpact*1.2));crashSound(.6);sparks(vehicle.position);addShake(Math.min(1,-landImpact*.06));}
      if(bike){
        vehicle.userData.lean.rotation.z=M.lerp(vehicle.userData.lean.rotation.z,-player.steer*Math.min(1,Math.abs(vf))*.45,.15);
      }else{
        // weight transfer: longitudinal accel pitches the body (squat under power, dive under braking),
        // lateral load + steer rolls it out of the corner — a sprung-chassis feel instead of key-driven tilt.
        const longA=vf-(vehicle.userData.pf||0);vehicle.userData.pf=vf;
        const body=vehicle.children[0];
        body.rotation.z=M.lerp(body.rotation.z,M.clamp(-player.steer*spd*.14-vl*.7,-.18,.18),.2);
        body.rotation.x=M.lerp(body.rotation.x,player.airborne?M.clamp(-player.vy*.018,-.45,.45):M.clamp(-longA*1.7,-.12,.15),.16);
      }
      vehicle.userData.wheels.forEach((w,i)=>{w.rotation.x+=vf*.7*dtF;if(!bike&&i<2)w.rotation.y=player.steer*.42;});
      if(vehicle.userData.brakeMat)vehicle.userData.brakeMat.emissiveIntensity=(k.dn||k.hb)?2.4:.4;   // brake lights glow when braking/handbraking
      if(boost&&frame%3===0)spawnP(pp.x-nfx*2.6,.5,pp.z-nfz*2.6,0x66bbff,.3,.3,rnd(-.05,.05),.05,rnd(-.05,.05));
      if(vehicle.userData.hp<40&&frame%6===0)spawnP(pp.x+nfx*2,1.3,pp.z+nfz*2,0x555555,.45,1,rnd(-.03,.03),.12,rnd(-.03,.03),{grav:-.004,grow:1.03,drag:.9});   // damage smoke rises & billows
      if(frame%9===0&&Math.abs(vf)<.3&&!bike)spawnP(pp.x-nfx*2.7,.4,pp.z-nfz*2.7,0x888888,.14,.5,0,.04,0,{grav:-.002,grow:1.04,drag:.92});   // idle exhaust puff drifts up
      // tyre skids: lay marks under the rear axle while handbraking or breaking traction at speed
      if(!bike&&!player.airborne&&spd>.25&&(k.hb||slide>.45)&&frame%2===0){
        const rx=pp.x-nfx*1.3,rz=pp.z-nfz*1.3,sx=Math.cos(player.heading)*.7,sz=-Math.sin(player.heading)*.7;
        dropSkid(rx+sx,rz+sz,player.heading);dropSkid(rx-sx,rz-sz,player.heading);
      }
      // shunt traffic
      for(const a of aiCars){
        const rr=rad+a.mesh.userData.rad;
        const dx=pp.x-a.mesh.position.x,dz=pp.z-a.mesh.position.z,d=Math.hypot(dx,dz);
        if(d<rr){
          const nx=dx/(d||1),nz=dz/(d||1),rel=Math.hypot(player.vx,player.vz);
          vehicle.position.x+=nx*(rr-d)*.6;vehicle.position.z+=nz*(rr-d)*.6;
          a.mesh.position.x-=nx*(rr-d)*.4;a.mesh.position.z-=nz*(rr-d)*.4;
          player.vx*=.92;player.vz*=.92;
          if(rel>.4){damageVehicle(rel*9);crashSound(rel*.7);sparks(vehicle.position);addShake(Math.min(.8,rel*.6));
            if(crimeCool<=0){addWanted(1);crimeCool=4;}}
        }
      }
      // shunt pursuit police cruisers too (cops[] aren't in aiCars)
      for(const c of cops){
        if(!c.mesh||c.mesh.userData.dead)continue;
        const rr=rad+c.mesh.userData.rad;
        const dx=pp.x-c.mesh.position.x,dz=pp.z-c.mesh.position.z,d=Math.hypot(dx,dz);
        if(d<rr){
          const nx=dx/(d||1),nz=dz/(d||1),rel=Math.hypot(player.vx,player.vz);
          vehicle.position.x+=nx*(rr-d)*.6;vehicle.position.z+=nz*(rr-d)*.6;
          c.mesh.position.x-=nx*(rr-d)*.4;c.mesh.position.z-=nz*(rr-d)*.4;
          player.vx*=.92;player.vz*=.92;
          if(rel>.4){damageVehicle(rel*9);crashSound(rel*.7);sparks(vehicle.position);addShake(Math.min(.8,rel*.6));addWanted(1);}
        }
      }
      // run down foot police while driving (mirrors the bullet-kill logic)
      if(spd>.3&&!player.airborne){
        for(let ci=copWalkers.length-1;ci>=0;ci--){const cw=copWalkers[ci];
          if(Math.hypot(cw.x-pp.x,cw.z-pp.z)<rad+.8){spawnBlood({x:cw.x,z:cw.z});scene.remove(cw.mesh);copWalkers.splice(ci,1);addWanted(2);crashSound(.3);}}
        for(let fi=footCops.length-1;fi>=0;fi--){const f=footCops[fi];
          if(Math.hypot(f.mesh.position.x-pp.x,f.mesh.position.z-pp.z)<rad+.8){spawnBlood(f.mesh.position);scene.remove(f.mesh);footCops.splice(fi,1);addWanted(2);crashSound(.3);}}
      }
      // smash through dynamic props
      for(const pr of dynProps){if(pr.dead)continue;
        const dx=pp.x-pr.x,dz=pp.z-pr.z,d=Math.hypot(dx,dz);
        if(d<rad+pr.rad){const rel=Math.hypot(player.vx,player.vz);knockProp(pr,-dx/(d||1),-dz/(d||1),rel*2.6+.35);}}
    }else if(!jack){
      // safety: on foot the avatar must always be in the scene & visible — rescues it from any stuck mount/exit state
      if(char.parent!==scene){scene.add(char);char.scale.setScalar(1);}
      char.visible=true;
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
      // momentum: ease velocity toward the desired direction instead of snapping — brisk accel/stop on the
      // ground, near-zero air control so a jump keeps its launch momentum (no mid-air direction snapping).
      const dvx=moveX*sp,dvz=moveZ*sp;
      const acc=player.airborne?.07:(moving?.34:.5);
      player.vx+=(dvx-player.vx)*Math.min(1,acc*dtF);
      player.vz+=(dvz-player.vz)*Math.min(1,acc*dtF);
      const pp={x:player.x+player.vx*dtF,z:player.z+player.vz*dtF,vx:player.vx,vz:player.vz};
      resolveCircle(pp,.5);if(player.y<1.0)resolveActors(pp,.5);   // skip actor push-out while up on a car roof
      player.x=M.clamp(pp.x,-WORLD+2,WORLD-2);player.z=M.clamp(pp.z,-WORLD+2,WORLD-2);
      player.vx=pp.vx;player.vz=pp.vz;
      // --- vertical: jump (Space) / gravity / land + stand on terrain, cars & props ---
      const sup=footSupport(player.x,player.z,player.y);
      if(player.y<=sup.h+.05){player.y=sup.h;if(player.vy<0)player.vy=0;
        if(k.hb&&!player.jumpHeld)player.vy=8.6;}     // jump off whatever supports you (units/sec)
      player.jumpHeld=k.hb;
      player.vy=Math.max(player.vy-24*dt,-45);player.y+=player.vy*dt;
      if(player.y<sup.h){player.y=sup.h;player.vy=0;}
      if(!isFinite(player.y)){player.y=0;player.vy=0;}     // NaN guard
      player.y=M.clamp(player.y,0,40);
      player.airborne=player.y>sup.h+.03;
      if(sup.car&&!player.airborne){if(player._rx!==undefined){player.x+=sup.car.position.x-player._rx;player.z+=sup.car.position.z-player._rz;}player._rx=sup.car.position.x;player._rz=sup.car.position.z;}
      else player._rx=undefined;
      char.position.set(player.x,player.y,player.z);char.rotation.y=player.heading;
      const gait=Math.min(1,Math.hypot(player.vx,player.vz)/.16);   // stride amplitude follows real speed → feet ease to a stop with momentum
      const s=Math.sin(perf*(k.boost?16:10))*gait,L=char.userData.limbs;
      L[0].rotation.x=s*.7;L[1].rotation.x=-s*.7;
      // hold the gun out and aim with the camera when armed
      const gm=char.userData.gunMount;
      if(armed){
        gm.visible=true;for(const kk in char.userData.guns)char.userData.guns[kk].visible=(kk===aw0);
        gm.rotation.y=camYaw;gm.rotation.x=0;       // two-handed aim grip points where the camera looks
        L[3].rotation.set(-1.5,0,-.13);L[2].rotation.set(-1.32,0,.2);
      }else{gm.visible=false;L[2].rotation.set(-s*.6,0,0);L[3].rotation.set(s*.6,0,0);}
      if(player.meleeAnim>0){const tt=Math.sin((1-player.meleeAnim/.25)*Math.PI);   // attack thrust
        if(armed){gm.rotation.x=-tt*1.2;L[3].rotation.set(-1.5-tt*.5,0,-.13);}       // knife stab
        else{gm.visible=false;L[3].rotation.set(-tt*1.95,0,0);L[2].rotation.set(s*.5,0,0);}}  // bare-fist jab
      for(const a of aiCars){
        if(player.y<1.2&&pdist(a.mesh.position.x,a.mesh.position.z)<1.6&&a.cur>.3)wastedNow();
      }
      // nudge props on foot
      for(const pr of dynProps){if(pr.dead)continue;
        const dx=player.x-pr.x,dz=player.z-pr.z,d=Math.hypot(dx,dz);
        if(d<.55+pr.rad){const hs=Math.hypot(player.vx,player.vz);knockProp(pr,-dx/(d||1),-dz/(d||1),hs*.9+.05);}}
      // gun pickups
      for(const g of pickups){
        if(pdist(g.position.x,g.position.z)<2.2){
          giveWeapon(g.userData.kind);
          scene.remove(g);pickups.splice(pickups.indexOf(g),1);
          setTimeout(spawnPickup,30000);
          break;
        }
      }
    }
    if(jack){jackUpdate(dt,dtF);pressedE=false;}
    else handleEnterExit(dtF);
    // attacking
    fireT-=dt;if(meleeT>0)meleeT-=dt;if(player.meleeAnim>0)player.meleeAnim-=dt;
    const w=owned[curW];
    const melee=w==='fist'||(WEAPONS[w]&&WEAPONS[w].melee);
    if((firing||keys.KeyF)&&!jack&&!player.inCar&&melee&&meleeT<=0){meleeAttack();}
    else if((firing||keys.KeyF)&&!jack&&!melee&&fireT<=0&&(ammo[w]||0)>0){
      const spec=WEAPONS[w];fireT=spec.rate;ammo[w]--;weaponHUD();
      const aimAng=player.heading+camYaw;
      let ox,oy=1.3,oz;
      if(player.inCar){const fx=Math.sin(aimAng),fz=Math.cos(aimAng);ox=player.x+fx*2.8;oz=player.z+fz*2.8;}
      else{const gun=char.userData.guns[w];gun.updateWorldMatrix(true,false);
        const mz=gun.localToWorld(new THREE.Vector3(0,0,gun.userData.muzzle));ox=mz.x;oy=mz.y;oz=mz.z;}
      const bvy=-Math.sin(camPitch)*1.6;   // vertical aim → headshots when looking up
      for(let i=0;i<spec.n;i++)shoot(ox,oy,oz,aimAng+rnd(-spec.spread,spec.spread),'player',spec.dmg,bvy+rnd(-spec.spread,spec.spread));
      spawnP(ox+Math.sin(aimAng)*.3,oy,oz+Math.cos(aimAng)*.3,0xfff2a0,.32,.07,0,.02,0);
      // gunfire panics nearby civilians and provokes gangs into a fight
      for(const p of peds){if(p.state==='down')continue;
        if(pdist(p.x,p.z)<24){if(p.state==='talk'&&talkingPed===p)talkingPed=null;
          p.state='flee';p.timer=3.4;if(Math.random()<.04)speak(4,p.x,p.z,'shout');}}
      for(const g of gangs)if(pdist(g.x,g.z)<28)provokeGang(g);
      // firing on or near police triggers an immediate tactical chase
      let copSeen=false;const near36=(x,z)=>pdist(x,z)<36;
      for(const c of cops)if(near36(c.mesh.position.x,c.mesh.position.z))copSeen=true;
      for(const f of footCops)if(near36(f.mesh.position.x,f.mesh.position.z))copSeen=true;
      for(const cw of copWalkers)if(near36(cw.x,cw.z))copSeen=true;
      for(const a of aiCars)if(a.police&&near36(a.mesh.position.x,a.mesh.position.z))copSeen=true;
      if(copSeen&&wanted<2)addWanted(2);
    }
    checkLandmarks(dt);
    // talk to nearby people
    if(!player.inCar){
      const tp=findNearestPed(4.5);
      if(tp&&!talkingPed){const prm=document.getElementById('prompt');prm.innerHTML='Press <b>T</b> to talk';prm.style.opacity=1;}
      if(talkReq&&tp){talkingPed=tp;tp.state='talk';tp.talkT=4.5;tp.talkSeed=1+((Math.random()*15)|0);tp.speakT=0;tp.talkLine=pick(TALK);}  // readable line + soft synthesized voice
    }
    talkReq=false;
  }
  crimeCool=Math.max(0,crimeCool-dt);

  // --- bullets ---
  for(let i=bullets.length-1;i>=0;i--){
    const b=bullets[i];b.life-=dt;
    let hit=b.life<=0;
    for(let s=0;s<3&&!hit;s++){
      b.m.position.x+=b.vx;b.m.position.z+=b.vz;b.m.position.y+=(b.vy||0);
      const bx=b.m.position.x,bz=b.m.position.z,by=b.m.position.y;
      if(Math.abs(bx)>WORLD||Math.abs(bz)>WORLD||pointInBuilding(bx,bz)){hit=true;break;}
      if(b.from==='player'){
        for(const p of peds)if(p.state!=='down'&&Math.hypot(p.x-bx,p.z-bz)<1.0){
          if(by>1.6)decapPed(p);                              // head shot
          else{p.hp-=b.dmg;if(p.hp<=0)downPed(p);else woundPed(p);}   // body shot wounds, then kills
          if(crimeCool<=0){addWanted(1);crimeCool=2;}hit=true;break;}
        if(hit)break;
        for(const g of gangs){if(g.state==='dead')continue;
          if(Math.hypot(g.x-bx,g.z-bz)<1.1){
            if(by>1.62){decapGang(g);hit=true;break;}          // head shot → decapitation
            g.hp-=b.dmg;spawnBlood({x:g.x,z:g.z});
            if(g.hp<=0)killGang(g);else{provokeGang(g);if(g.hp<60)g.wound=true;}hit=true;break;}}
        if(hit)break;
        for(let ci=copWalkers.length-1;ci>=0;ci--){const cw=copWalkers[ci];
          if(Math.hypot(cw.x-bx,cw.z-bz)<1.1){
            if(by>1.6)decapFx(cw.x,cw.z,0xd9a173);
            spawnBlood({x:cw.x,z:cw.z});scene.remove(cw.mesh);copWalkers.splice(ci,1);addWanted(2);hit=true;break;}}
        if(hit)break;
        for(let fi=footCops.length-1;fi>=0;fi--){
          const f=footCops[fi];
          if(Math.hypot(f.mesh.position.x-bx,f.mesh.position.z-bz)<1.1){
            if(by>1.6)decapFx(f.mesh.position.x,f.mesh.position.z,0xd9a173);
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
        for(const pr of dynProps){if(pr.dead)continue;
          if(Math.hypot(pr.x-bx,pr.z-bz)<pr.rad+.3){
            if(pr.breakable)breakProp(pr);else{knockProp(pr,b.vx,b.vz,2.4);sparks({x:pr.x,z:pr.z});}
            hit=true;break;}}
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
  // LOD: skip per-frame AI for entities far from the player (they're tiny dots at distance) → keeps FPS up as the world fills
  const CULL=240;
  for(const a of aiCars)if(pdist(a.mesh.position.x,a.mesh.position.z)<CULL)aiUpdate(a,dtF);
  for(const c of cows)if(pdist(c.mesh.position.x,c.mesh.position.z)<CULL)cowUpdate(c,dtF);
  for(const g of gangs)if(g.state==='aggro'||pdist(g.x,g.z)<CULL)gangUpdate(g,dtF);   // aggro gangs always tick (combat)
  for(const cw of copWalkers)if(pdist(cw.x,cw.z)<CULL)copWalkerUpdate(cw,dtF);
  dynUpdate(dtF);updateFlyHeads(dtF,dt);updateSkids(dt);
  if(river&&river.waterMat)river.waterMat.uniforms.uTime.value=perf; // flowing water animation
  for(const p of peds)if(pdist(p.x,p.z)<CULL)pedUpdate(p,dtF);
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
    p.vy-=p.grav*dtF;
    const ps=p.m.position;ps.x+=p.vx*dtF;ps.y+=p.vy*dtF;ps.z+=p.vz*dtF;
    if(p.drag!==1){const d=Math.pow(p.drag,dtF);p.vx*=d;p.vz*=d;}
    const gy=groundHeightAt(ps.x,ps.z)+p.m.scale.x*.5;       // rest on whatever surface is below
    if(ps.y<gy){ps.y=gy;
      if(p.bounce>0&&p.vy<-.05){p.vy=-p.vy*p.bounce;p.vx*=.6;p.vz*=.6;}   // bounce & lose energy
      else{p.vy=0;const f=Math.pow(.45,dtF);p.vx*=f;p.vz*=f;}              // settle with ground friction
    }
    p.m.scale.multiplyScalar(Math.pow(p.grow,dtF));p.m.material.opacity=p.life/p.max;
  }

  // --- taxi career ---
  if(!dead)taxiUpdate(dt,dtF);
  if(taxiMarker.visible){taxiMarker.rotation.y+=dt;taxiMarker.children[0].position.y=.6+Math.sin(perf*3)*.25;}
  if(race.marker&&!race.active){race.marker.rotation.y+=dt*1.5;race.marker.children[0].position.y=.6+Math.sin(perf*3)*.3;}
  if(!dead){
    if(!race.active&&player.inCar&&vehicle&&vehicle.userData.type==='car'&&pdist(race.wp[0].x,race.wp[0].z)<6)startRace();   // drive into the start ring
    raceUpdate(dt,dtF);courierUpdate(dt);
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
  // dynamic exposure: brighter at high noon, lifted at night so the city stays readable (cinematic depth)
  renderer.toneMappingExposure=.92+dayF*.26+(1-dayF)*.12;
  hemi.intensity=.1+dayF*.34;     // env map now supplies ambient fill, so dial the hemisphere down
  const night=1-dayF;
  // wet-asphalt look after dark: drop roughness & lift metalness/env reflectivity so the sky and streetlights mirror in the road
  ground.material.roughness=M.lerp(.88,.42,night);
  ground.material.metalness=M.lerp(.04,.34,night);
  ground.material.envMapIntensity=M.lerp(.25,.9,night);
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

  // NaN sentinel: one bad physics frame must never permanently poison the camera (the blue-screen lock bug).
  // M.clamp/lerp propagate NaN forever, so snap back to the last finite player position instead.
  if(isFinite(player.x)&&isFinite(player.y)&&isFinite(player.z)){player._gx=player.x;player._gy=player.y;player._gz=player.z;}
  else{player.x=player._gx||0;player.y=player._gy||0;player.z=player._gz||0;player.vx=player.vz=player.vy=0;player.airborne=false;}

  // --- camera (third-person, mouse-orbit) ---
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
  if(player.inCar&&vehicle&&vehicle.userData.type==='plane'){dist=18+spd*3;baseH=6;ly=2;}
  if(player.inCar&&vehicle&&vehicle.userData.type==='heli'){dist=15+spd*3;baseH=5.5;ly=2.4;}
  if(insideLM&&!player.inCar){dist=4.2;baseH=4.6;ly=1.4;}   // tuck the camera in under the open roof
  const py=player.y;
  const cx=player.x-cfx*dist*ch, cz=player.z-cfz*dist*ch, cy=baseH+py+dist*cv+(player.inCar?spd*1.4:0);
  // self-heal: if the camera ever went non-finite, lerp can never recover it — snap straight to target
  if(!isFinite(camera.position.x)||!isFinite(camera.position.y)||!isFinite(camera.position.z))camera.position.set(cx,cy,cz);
  camera.position.x=M.lerp(camera.position.x,cx,.12*dtF);
  camera.position.y=M.lerp(camera.position.y,cy,.12*dtF);
  camera.position.z=M.lerp(camera.position.z,cz,.12*dtF);
  if(player.inCar&&spd>.6){ // speed rumble
    camera.position.y+=(Math.random()-.5)*spd*.05;
    camera.position.x+=(Math.random()-.5)*spd*.04;
  }
  if(shake>.001){ // impact shake: punchy then settles (s² ease-out), frame-rate independent decay
    const s=shake*shake;
    camera.position.x+=(Math.random()-.5)*s*1.3;
    camera.position.y+=(Math.random()-.5)*s*1.1;
    camera.position.z+=(Math.random()-.5)*s*1.3;
    shake*=Math.pow(.86,dtF);
  }
  // never let the camera dip below the surface beneath it: the ground is a single-sided plane, so going under it
  // shows nothing but the blue sky background — this was the "screen turns blue, camera stuck on sky" bug after exiting.
  const camFloor=groundHeightAt(camera.position.x,camera.position.z)+0.4;
  if(camera.position.y<camFloor)camera.position.y=camFloor;
  camera.lookAt(player.x+cfx*2,ly+py,player.z+cfz*2);
  const tFov=70+(player.inCar?spd*8:0);
  if(Math.abs(camera.fov-tFov)>.3){camera.fov=M.lerp(camera.fov,tFov,.08);camera.updateProjectionMatrix();}

  // --- audio ---
  if(actx&&eng.g){
    if(actx.state==='suspended')actx.resume();
    const inCar=player.inCar&&vehicle&&!vehicle.userData.dead;
    const vt=inCar?vehicle.userData.type:null,ground=inCar&&vt!=='plane'&&vt!=='heli';
    // engine: volume swells under power, pitch rises with speed (bikes rev higher); both smoothed to avoid zipper noise
    const tgtGain=ground?(.028+spd*.05+(k.up?.018:0)):0;
    eng.g.gain.value+=(tgtGain-eng.g.gain.value)*Math.min(1,.25*dtF);
    const revBase=vt==='bike'?95:vt==='auto'?58:70;
    const tgtFreq=ground?(revBase+spd*(vt==='bike'?230:170)+(k.up?20:0)):eng.o.frequency.value;
    eng.o.frequency.value+=(tgtFreq-eng.o.frequency.value)*Math.min(1,.3*dtF);
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
      _pos.set(talkingPed.x,2.3,talkingPed.z).project(camera);
      // readable dialogue line from TALK[], gently pulsing while the soft voice plays
      if(_pos.z<1){bub.textContent=talkingPed.talkLine||'…';bub.style.opacity=(0.85+Math.abs(Math.sin(perf*5))*0.15);bub.style.display='block';
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
    document.getElementById('obj').textContent=race.active?('🏁 LAP '+Math.min(race.lap+1,RACE_LAPS)+'/'+RACE_LAPS+' · P'+(race.pos||1)+'/'+(racers.length+1)):courier.active?('📦 COURIER · '+courier.drops+'/'+courier.total+' · '+Math.ceil(courier.time)+'s'):vigil.active?('🎯 VIGILANTE  '+vigil.kills+'/'+vigil.goal):taxi.active?
      (taxi.phase==='ride'?'TAXI · '+Math.round(Math.hypot(player.x-taxi.dest.x,player.z-taxi.dest.z))+'m to drop-off':
       taxi.phase==='toCar'?'TAXI · passenger boarding…':'TAXI · fare in progress')
      :((vehicle&&vehicle.userData.taxi)?'Press 1 to start a taxi fare':onboardHint());
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
