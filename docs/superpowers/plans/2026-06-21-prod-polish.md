# Prod-Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a main menu, progression save/Continue, pause, and an essentials settings menu to the browser game, and hide debug hooks from public builds.

**Architecture:** Two pure leaf modules under `src/core/` own persistence (`save.js`, `settings.js`); `index.html` gains three DOM overlays (main menu rework, `#pause`, `#settings`); `src/main.js` wires boot/apply/pause logic. Menus are DOM overlays, not WebGL. Live-exports model, consistent with the in-progress module split.

**Tech Stack:** three.js r128 (CDN import map), vanilla ES modules, `localStorage`, WebAudio. No build step. Tests are headless puppeteer rigs in `/tmp/gta_test` driven by `window.__probe()`.

## Global Constraints

- No build step; ES modules loaded directly. Relative imports like `./core/x.js` only.
- Compact house style: short names, semicolon-terminated lines, `// ---------- name ----------` banners.
- Keep files under 500 lines. New HUD/overlay z-index: pause 45, settings 55 (overlays 30+, intro 50, error 99).
- All world constants already imported from `core/constants.js`; math from `core/math.js`.
- NO `Co-Authored-By` trailer on commits. Commit + push to `main` (= GitHub Pages prod).
- Persistence keys: `gta_save_v1`, `gta_settings_v1`. Settings defaults: `{volume:1, sensitivity:1, invertY:false, quality:'high'}`.
- Every `localStorage` access try/caught → degrade to defaults/no-op, never throw.
- Test gate each task: `cp src/main.js /tmp/c.mjs && node --check /tmp/c.mjs` AND the relevant `/tmp/gta_test` rig prints `ERRORS: NONE` with `#err` not displayed.
- Server for tests: `python3 -m http.server 8099` from repo root (run in background).

---

### Task 1: Persistence modules (`core/settings.js`, `core/save.js`)

**Files:**
- Create: `src/core/settings.js`
- Create: `src/core/save.js`

**Interfaces:**
- Produces (`settings.js`): `SETTINGS_DEFAULTS:{volume,sensitivity,invertY,quality}`, `loadSettings():object`, `saveSettings(s):void`.
- Produces (`save.js`): `hasSave():boolean`, `loadProgress():{money,owned,ammo}|null`, `saveProgress(data):void` (debounced ~1s).

- [ ] **Step 1: Write `src/core/settings.js`**

```js
// core/settings.js — persisted player settings (localStorage). Pure storage; applying is main.js's job.
const KEY='gta_settings_v1';
export const SETTINGS_DEFAULTS={volume:1,sensitivity:1,invertY:false,quality:'high'};
export function loadSettings(){
  try{const r=JSON.parse(localStorage.getItem(KEY));if(r&&typeof r==='object')return {...SETTINGS_DEFAULTS,...r};}catch(e){}
  return {...SETTINGS_DEFAULTS};
}
export function saveSettings(s){
  try{localStorage.setItem(KEY,JSON.stringify({volume:s.volume,sensitivity:s.sensitivity,invertY:s.invertY,quality:s.quality}));}catch(e){}
}
```

- [ ] **Step 2: Write `src/core/save.js`**

```js
// core/save.js — progression-only save (money/owned/ammo) to localStorage. World is not persisted.
const KEY='gta_save_v1';let timer=null;
export function hasSave(){try{const r=JSON.parse(localStorage.getItem(KEY));return !!(r&&r.v===1&&typeof r.money==='number'&&Array.isArray(r.owned));}catch(e){return false;}}
export function loadProgress(){
  try{const r=JSON.parse(localStorage.getItem(KEY));
    if(r&&r.v===1)return {money:r.money,owned:r.owned.slice(),ammo:Object.assign({},r.ammo)};}catch(e){}
  return null;
}
export function saveProgress(data){
  if(timer)clearTimeout(timer);
  timer=setTimeout(()=>{timer=null;
    try{localStorage.setItem(KEY,JSON.stringify({v:1,money:data.money,owned:data.owned,ammo:data.ammo}));}catch(e){}
  },1000);
}
```

- [ ] **Step 3: Syntax check both modules**

Run: `node --check src/core/settings.js && node --check src/core/save.js && echo OK`
Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add src/core/settings.js src/core/save.js
git commit -m "Prod-polish: add core/settings.js + core/save.js persistence modules"
```

---

### Task 2: Menu/pause/settings DOM + styles (`index.html`)

**Files:**
- Modify: `index.html` (rework `#intro`; add `#pause`, `#settings`; add CSS)

**Interfaces:**
- Produces (DOM ids consumed by Task 3–5): buttons `#mNew`, `#mContinue`, `#mSettings`; pause `#pause`, `#pResume`, `#pSettings`, `#pQuit`; settings `#settings`, `#setVol`, `#setSens`, `#setInvert`, `#setQuality`, `#setBack`.

- [ ] **Step 1: Replace the `#intro` body block**

In `index.html`, replace the existing `<div id="intro">...</div>` block with:

```html
<div id="intro">
  <h1>GRAND THIEF AUXTO</h1>
  <h2>Bharat Version &nbsp;•&nbsp; an open world crime sandbox</h2>
  <div class="menu">
    <button id="mNew" class="mbtn">NEW GAME</button>
    <button id="mContinue" class="mbtn" disabled>CONTINUE</button>
    <button id="mSettings" class="mbtn">SETTINGS</button>
  </div>
  <details class="howto"><summary>How to play</summary>
    <table>
      <tr><td>W A S D</td><td>drive / walk (camera-relative on foot)</td></tr>
      <tr><td>MOUSE</td><td>look around &amp; aim — steers you on foot (click to lock)</td></tr>
      <tr><td>SPACE</td><td>handbrake (drift!)</td></tr>
      <tr><td>SHIFT</td><td>boost / sprint</td></tr>
      <tr><td>E</td><td>enter / exit &amp; steal cars, bikes and autos</td></tr>
      <tr><td>T</td><td>talk to nearby people</td></tr>
      <tr><td>CLICK / F</td><td>shoot (find gun pickups around the city)</td></tr>
      <tr><td>Q</td><td>switch weapon</td></tr>
      <tr><td>H</td><td>horn</td></tr>
      <tr><td>M</td><td>city map &nbsp;•&nbsp; ESC pause</td></tr>
    </table>
  </details>
</div>
```

- [ ] **Step 2: Add the pause + settings overlays** before `<div id="err">`

```html
<div id="pause" class="ovl"><div class="panel">
  <h3>PAUSED</h3>
  <button id="pResume" class="mbtn">RESUME</button>
  <button id="pSettings" class="mbtn">SETTINGS</button>
  <button id="pQuit" class="mbtn">QUIT TO MENU</button>
</div></div>
<div id="settings" class="ovl"><div class="panel">
  <h3>SETTINGS</h3>
  <label>Volume <input id="setVol" type="range" min="0" max="1" step="0.05"></label>
  <label>Mouse sensitivity <input id="setSens" type="range" min="0.3" max="2" step="0.05"></label>
  <label class="chk"><input id="setInvert" type="checkbox"> Invert Y</label>
  <label>Graphics <select id="setQuality"><option value="low">Low</option><option value="med">Medium</option><option value="high">High</option></select></label>
  <button id="setBack" class="mbtn">BACK</button>
</div></div>
```

- [ ] **Step 3: Add CSS** inside the second `<style>` block (after `#bubble` rules)

```css
  .menu{display:flex;flex-direction:column;gap:12px;margin:6px 0 18px}
  .mbtn{pointer-events:auto;cursor:pointer;font:900 18px 'Russo One',Arial;letter-spacing:1px;color:#1a2330;background:#ffd23e;border:none;border-radius:8px;padding:12px 40px;box-shadow:0 3px 0 #b3531a;transition:transform .08s}
  .mbtn:hover{transform:translateY(-2px)}
  .mbtn:disabled{opacity:.4;cursor:default;box-shadow:0 3px 0 #555;background:#caa}
  .howto summary{cursor:pointer;color:#9fb6d8;font:700 14px Arial;pointer-events:auto}
  .ovl{position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:rgba(5,8,14,.82)}
  #pause{z-index:45}#settings{z-index:55}
  .panel{display:flex;flex-direction:column;gap:14px;align-items:stretch;background:#11192a;border:2px solid #2a3a55;border-radius:14px;padding:28px 34px;min-width:300px;color:#cfd8e6}
  .panel h3{margin:0 0 6px;text-align:center;font:900 26px 'Russo One',Arial;color:#ffd23e}
  .panel label{display:flex;justify-content:space-between;align-items:center;gap:14px;font:600 14px Arial;pointer-events:auto}
  .panel input[type=range]{pointer-events:auto}.panel .chk{justify-content:flex-start;gap:8px}
  .panel select{pointer-events:auto}
```

- [ ] **Step 4: Start the test server and smoke the page**

```bash
pkill -f 'http.server'; (cd /home/pratyush/my_gta && python3 -m http.server 8099 &) ; sleep 2
cd /tmp/gta_test && node dbg4.js 2>&1 | tail -3
```
Expected: `ERRORS: NONE` (menu DOM present but not yet wired; game still boots on key/click via existing `start()`).

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "Prod-polish: main-menu / pause / settings DOM + styles"
```

---

### Task 3: Settings wiring — load, live-apply, panel handlers

**Files:**
- Modify: `src/main.js` (imports; master gain in `initAudio`; mousemove 1186–1187; composer refs 99–129; new settings block; `__probe`)

**Interfaces:**
- Consumes: `loadSettings`, `saveSettings`, `SETTINGS_DEFAULTS` from `./core/settings.js`.
- Produces: global `settings` object; `applySettings(s)`; `setQuality(q)`; `masterGain` node. `__probe().settings` reflects applied values.

- [ ] **Step 1: Import settings** — add after the `buildRoadNetwork` import near the top of `src/main.js`

```js
import { loadSettings, saveSettings, SETTINGS_DEFAULTS } from './core/settings.js';
```

- [ ] **Step 2: Capture composer pass refs** — in the composer block (lines ~99–129), change the SSAO and SMAA pass creation to keep references. Replace `let composer=null,bloomPass=null;` with:

```js
let composer=null,bloomPass=null,ssaoPass=null,smaaPass=null,lowGfx=false;
```
Then in the block set `ssaoPass=ssao;` right after `const ssao=new SSAOPass(...)` (before `composer.addPass(ssao)`), and replace `if(SMAAPass)composer.addPass(new SMAAPass(innerWidth,innerHeight));` with:
```js
  if(SMAAPass){smaaPass=new SMAAPass(innerWidth,innerHeight);composer.addPass(smaaPass);}
```

- [ ] **Step 3: Make `renderFrame` honor low mode** — replace line 129:

```js
function renderFrame(){(composer&&!lowGfx)?composer.render():renderer.render(scene,camera);}
```

- [ ] **Step 4: Add master gain in `initAudio`** — at the top of `initAudio()` body (after `actx` is created), add:

```js
  if(!masterGain){masterGain=actx.createGain();masterGain.gain.value=settings.volume;masterGain.connect(actx.destination);}
```
Declare near the audio globals (by `let skidGain`): `let masterGain=null;`
Then reroute audio output: run `grep -c 'actx.destination' src/main.js` (note the count), and replace every `actx.destination` occurrence EXCEPT the one inside the `masterGain.connect(actx.destination)` line with `masterGain`. (Search/replace, then restore that one line.)

- [ ] **Step 5: Add the settings state + apply + handlers** — add a new block after the mousemove handler (after line ~1188):

```js
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
}
```

- [ ] **Step 6: Apply sensitivity + invertY in mousemove** — replace lines 1186–1187:

```js
  camYaw-=e.movementX*0.0026*settings.sensitivity;
  camPitch=M.clamp(camPitch+e.movementY*0.0024*settings.sensitivity*(settings.invertY?-1:1),-0.5,1.0);
```

- [ ] **Step 7: Add settings to `__probe`** — in the probe (line ~104, by the TEMP diag), append:

```js
    st.settings={volume:settings.volume,sensitivity:settings.sensitivity,invertY:settings.invertY,quality:settings.quality}; // TEMP diag
```

- [ ] **Step 8: Write the settings test rig** `/tmp/gta_test/prod_settings.js`

```js
const puppeteer=require('puppeteer-core');const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const EXE=process.env.HOME+'/.cache/puppeteer/chrome-headless-shell/linux-149.0.7827.22/chrome-headless-shell-linux64/chrome-headless-shell';
const ARGS=['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader'];
(async()=>{
 const b=await puppeteer.launch({executablePath:EXE,args:ARGS,defaultViewport:{width:900,height:560}});
 const p=await b.newPage();const errs=[];
 p.on('pageerror',e=>errs.push('PE:'+e.message));p.on('console',m=>{if(m.type()==='error')errs.push('C:'+m.text().slice(0,160));});
 await p.goto('http://localhost:8099/index.html',{waitUntil:'networkidle0',timeout:60000});
 await sleep(2000);
 // open settings from menu, set quality=low + volume 0, read applied
 await p.click('#mSettings');await sleep(300);
 await p.select('#setQuality','low');await p.evaluate(()=>{const v=document.getElementById('setVol');v.value=0;v.dispatchEvent(new Event('input'));});
 await sleep(300);let s=await p.evaluate(()=>__probe().settings);console.log('applied',JSON.stringify(s));
 // reload → settings persisted
 await p.reload({waitUntil:'networkidle0'});await sleep(2000);
 let s2=await p.evaluate(()=>__probe().settings);console.log('after reload',JSON.stringify(s2));
 // start a game on low gfx → no error
 await p.click('#setBack');await sleep(200);await p.click('#mNew');await sleep(800);
 const started=await p.evaluate(()=>__probe().inCar!==undefined);
 const err=await p.evaluate(()=>document.getElementById('err').style.display==='flex');
 console.log('startedOK',started,'errDiv',err,'ERRORS:',errs.length?errs.join(' | '):'NONE');
 await b.close();
})().catch(e=>console.log('FAIL:',e.message));
```

- [ ] **Step 9: Syntax check + run rig**

```bash
cp src/main.js /tmp/c.mjs && node --check /tmp/c.mjs && echo SYNTAX OK
cd /tmp/gta_test && node prod_settings.js 2>&1 | tail -5
```
Expected: `SYNTAX OK`; `applied {"volume":0,...,"quality":"low"}`; `after reload` shows quality `low` volume `0`; `startedOK true`; `ERRORS: NONE`.

- [ ] **Step 10: Commit**

```bash
git add src/main.js
git commit -m "Prod-polish: settings load + live-apply (master-gain volume, sensitivity, invert-Y, gfx quality) + panel wiring"
```

---

### Task 4: Progression save + New Game / Continue

**Files:**
- Modify: `src/main.js` (imports; menu button handlers; `start()` ~1192; main loop auto-save; `__probe`)

**Interfaces:**
- Consumes: `hasSave`, `loadProgress`, `saveProgress` from `./core/save.js`; the `#mNew`/`#mContinue` buttons; existing `start()`, `money`, `owned`, `ammo`, `weaponHUD()`.
- Produces: `start(continueSave)` accepts a boolean; auto-save tick; `__probe().hasSave`.

- [ ] **Step 1: Import save** — add near the settings import:

```js
import { hasSave, loadProgress, saveProgress } from './core/save.js';
```

- [ ] **Step 2: Make `start()` accept Continue** — replace the `function start(){...}` signature/first lines (~1192) so it takes a flag and restores progression:

```js
function start(continueSave){if(started||!assetsReady)return;started=true;initAudio();
  if(continueSave){const sv=loadProgress();if(sv){money=sv.money;owned.length=0;for(const w of sv.owned)owned.push(w);for(const k in sv.ammo)ammo[k]=sv.ammo[k];curW=0;weaponHUD();}}
  document.getElementById('intro').style.display='none';
```
(Keep the rest of the original `start()` body — pointer lock request etc. — unchanged.)

- [ ] **Step 3: Wire menu buttons + remove auto-start-on-any-key** — the current code calls `start()` from a global keydown/click/mousedown. Find those calls (search `start();`) and remove the auto-start ones, then add explicit button handlers in the settings block (Task 3 Step 5) area:

```js
{const $=id=>document.getElementById(id);
 $('mNew').addEventListener('click',()=>start(false));
 $('mContinue').addEventListener('click',()=>start(true));
 if(hasSave())$('mContinue').disabled=false;}
```
Note: keep the canvas `click`→pointer-lock handler (it is guarded by `if(started...)`). Only remove the unconditional `start()` invocations tied to intro key/click.

- [ ] **Step 4: Auto-save tick** — inside `animate()`, in the `if(!dead){...}` region (once per frame is fine; the module debounces), add:

```js
    saveProgress({money,owned:owned.slice(),ammo:Object.assign({},ammo)});
```

- [ ] **Step 5: Add `hasSave` to `__probe`** — append by the TEMP diag:

```js
    st.hasSave=hasSave(); // TEMP diag
```

- [ ] **Step 6: Write Continue test rig** `/tmp/gta_test/prod_save.js`

```js
const puppeteer=require('puppeteer-core');const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const EXE=process.env.HOME+'/.cache/puppeteer/chrome-headless-shell/linux-149.0.7827.22/chrome-headless-shell-linux64/chrome-headless-shell';
const ARGS=['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader'];
(async()=>{
 const b=await puppeteer.launch({executablePath:EXE,args:ARGS,defaultViewport:{width:900,height:560}});
 const p=await b.newPage();const errs=[];
 p.on('pageerror',e=>errs.push('PE:'+e.message));p.on('console',m=>{if(m.type()==='error')errs.push('C:'+m.text().slice(0,160));});
 await p.goto('http://localhost:8099/index.html',{waitUntil:'networkidle0',timeout:60000});
 await sleep(2000);await p.click('#mNew');await sleep(800);
 // earn money + weapons via cheats (RICH + TOOLED), let auto-save fire
 for(const c of 'RICH')await p.keyboard.press('Key'+c);await sleep(300);
 for(const c of 'TOOLED')await p.keyboard.press('Key'+c);await sleep(1500);
 const before=await p.evaluate(()=>({m:__probe().money,o:__probe().owned}));console.log('before',JSON.stringify(before));
 await p.reload({waitUntil:'networkidle0'});await sleep(2000);
 const canContinue=await p.evaluate(()=>!document.getElementById('mContinue').disabled);
 await p.click('#mContinue');await sleep(800);
 const after=await p.evaluate(()=>({m:__probe().money,o:__probe().owned}));
 const err=await p.evaluate(()=>document.getElementById('err').style.display==='flex');
 console.log('canContinue',canContinue,'after',JSON.stringify(after),'errDiv',err,'ERRORS:',errs.length?errs.join(' | '):'NONE');
 await b.close();
})().catch(e=>console.log('FAIL:',e.message));
```

- [ ] **Step 7: Syntax check + run rig**

```bash
cp src/main.js /tmp/c.mjs && node --check /tmp/c.mjs && echo SYNTAX OK
cd /tmp/gta_test && node prod_save.js 2>&1 | tail -5
```
Expected: `before` money ≥ 50000 with several weapons; `canContinue true`; `after` money & weapons match `before`; `ERRORS: NONE`.

- [ ] **Step 8: Commit**

```bash
git add src/main.js
git commit -m "Prod-polish: progression save + New Game / Continue restore (auto-save money/weapons/ammo)"
```

---

### Task 5: Pause

**Files:**
- Modify: `src/main.js` (pause flag + handlers; `pointerlockchange`; loop gate ~2407; `clock` reset; `__probe`)

**Interfaces:**
- Consumes: `#pause`, `#pResume`, `#pSettings`, `#pQuit` buttons; `started`, `bigOpen`, `clock`, `renderFrame`.
- Produces: global `paused`; `__probe().paused`.

- [ ] **Step 1: Add pause state + handlers** — add a block near the menu/settings wiring:

```js
// ---------- pause ----------
let paused=false;
function setPaused(v){
  paused=v;document.getElementById('pause').style.display=v?'flex':'none';
  if(v){if(document.exitPointerLock)document.exitPointerLock();}
  else{clock.getDelta();const c=document.getElementById('c');if(c.requestPointerLock)c.requestPointerLock();}
}
document.addEventListener('pointerlockchange',()=>{
  if(!document.pointerLockElement&&started&&!bigOpen&&!paused&&!dead)setPaused(true);
});
{const $=id=>document.getElementById(id);
 $('pResume').addEventListener('click',()=>setPaused(false));
 $('pSettings').addEventListener('click',()=>{$('pause').style.display='none';window.__openSettings('pause');});
 $('pQuit').addEventListener('click',()=>{paused=false;$('pause').style.display='none';started=false;$('intro').style.display='flex';if(hasSave())$('mContinue').disabled=false;});}
```
(`clock.getDelta()` on resume discards the long paused delta so the sim doesn't jump. `clock` is defined at the top of the main-loop section ~line 2421; this block must appear after `clock` is declared — place it just below the `const clock=new THREE.Clock()` line.)

- [ ] **Step 2: Gate the loop** — replace the loop guard (line ~2407 `if(!started||bigOpen){renderFrame();return;}`):

```js
  if(!started||bigOpen||paused){renderFrame();return;}
```

- [ ] **Step 3: Add `paused` to `__probe`** — append by the TEMP diag:

```js
    st.paused=paused; // TEMP diag
```

- [ ] **Step 4: Write pause test rig** `/tmp/gta_test/prod_pause.js`

```js
const puppeteer=require('puppeteer-core');const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const EXE=process.env.HOME+'/.cache/puppeteer/chrome-headless-shell/linux-149.0.7827.22/chrome-headless-shell-linux64/chrome-headless-shell';
const ARGS=['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader'];
(async()=>{
 const b=await puppeteer.launch({executablePath:EXE,args:ARGS,defaultViewport:{width:900,height:560}});
 const p=await b.newPage();const errs=[];
 p.on('pageerror',e=>errs.push('PE:'+e.message));p.on('console',m=>{if(m.type()==='error')errs.push('C:'+m.text().slice(0,160));});
 await p.goto('http://localhost:8099/index.html',{waitUntil:'networkidle0',timeout:60000});
 await sleep(2000);await p.click('#mNew');await sleep(800);
 // force pause via the same path a lock-loss triggers
 await p.evaluate(()=>setPaused(true));await sleep(300);
 const x0=await p.evaluate(()=>__probe().px);
 await p.keyboard.down('KeyW');await sleep(800);await p.keyboard.up('KeyW');
 const x1=await p.evaluate(()=>__probe().px);
 const pausedNow=await p.evaluate(()=>__probe().paused);
 await p.click('#pResume');await sleep(200);
 const resumed=await p.evaluate(()=>!__probe().paused);
 const err=await p.evaluate(()=>document.getElementById('err').style.display==='flex');
 console.log('pausedNow',pausedNow,'frozen',x0===x1,'resumed',resumed,'errDiv',err,'ERRORS:',errs.length?errs.join(' | '):'NONE');
 await b.close();
})().catch(e=>console.log('FAIL:',e.message));
```

- [ ] **Step 5: Syntax check + run rig**

```bash
cp src/main.js /tmp/c.mjs && node --check /tmp/c.mjs && echo SYNTAX OK
cd /tmp/gta_test && node prod_pause.js 2>&1 | tail -4
```
Expected: `pausedNow true`, `frozen true`, `resumed true`, `ERRORS: NONE`.

- [ ] **Step 6: Commit**

```bash
git add src/main.js
git commit -m "Prod-polish: pause (lock-loss → pause overlay, loop freeze, resume/quit-to-menu)"
```

---

### Task 6: Debug-hook hardening

**Files:**
- Modify: `src/main.js` (gate `window.__probe`/`__tp`/`__cam` assignments)

**Interfaces:**
- Consumes: nothing new.
- Produces: debug hooks present only when `location.hostname==='localhost'` or `location.search.includes('debug')`.

- [ ] **Step 1: Add a debug gate** — near the top of `main()` (after the `buildRoadNetwork()` line), add:

```js
const DEBUG=location.hostname==='localhost'||location.hostname==='127.0.0.1'||location.search.includes('debug');
```

- [ ] **Step 2: Guard each hook** — wrap the three `window.__*` assignments (`__probe` ~line 73, `__cam` ~79, `__tp` ~109). Change each `window.__x=...` to:

```js
if(DEBUG)window.__probe=()=>{ /* ...unchanged body... */ };
if(DEBUG)window.__cam=(p,y)=>{ /* unchanged */ };
if(DEBUG)window.__tp=(x,z)=>{ /* unchanged */ };
```
(Only prepend `if(DEBUG)` — bodies unchanged.)

- [ ] **Step 3: Syntax check + confirm tests still pass on localhost**

```bash
cp src/main.js /tmp/c.mjs && node --check /tmp/c.mjs && echo SYNTAX OK
cd /tmp/gta_test && node cheat.js 2>&1 | tail -2 && node prod_save.js 2>&1 | tail -2 && node prod_pause.js 2>&1 | tail -2
```
Expected: `SYNTAX OK`; all rigs `ERRORS: NONE` (probe still present because tests use `localhost:8099`).

- [ ] **Step 4: Confirm hooks are hidden in prod-like mode** — quick check that a non-localhost host would omit them is covered by the `DEBUG` expression; no separate rig needed (headless can only reach localhost).

- [ ] **Step 5: Commit + push**

```bash
git add src/main.js
git commit -m "Prod-polish: gate debug hooks (__probe/__tp/__cam) to localhost or ?debug"
git push origin main
```

---

## Self-Review

- **Spec coverage:** save.js/settings.js (Task 1) ✓; menu/pause/settings DOM (Task 2) ✓; settings load+live-apply incl. master-gain volume, sensitivity, invertY, quality presets (Task 3) ✓; New Game/Continue + auto-save (Task 4) ✓; pause via pointer-lock loss + loop freeze + quit-to-menu (Task 5) ✓; debug hardening (Task 6) ✓; probe fields settings/hasSave/paused added in Tasks 3/4/5 ✓; localStorage try/catch degrade (Task 1) ✓.
- **Type consistency:** `start(continueSave:boolean)`, `applySettings(s)`, `setQuality(q)`, `setPaused(v)`, `saveProgress({money,owned,ammo})`, `loadProgress()→{money,owned,ammo}`, `hasSave()→boolean`, `window.__openSettings(from)` — names consistent across tasks.
- **Note for implementer:** Task 3 Step 4 (audio reroute) and Task 4 Step 3 (removing the unconditional `start()` calls) are the two highest-risk edits — verify with the rigs before committing. The menu now requires an explicit button click to start (no more "press any key"), which is the intended prod behavior.
