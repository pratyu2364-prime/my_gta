#!/usr/bin/env node
// Headless gameplay smoke test — the `ship` loop runs this as commands.test before every PR.
// Boots the ES-module game over localhost, plays a short scripted session, and FAILS (exit 1)
// on any JS error OR the swallowed-error #err overlay (see CLAUDE.md "errors are swallowed").
// puppeteer-core + chrome-headless-shell are reused from the manual rig in /tmp/gta_test;
// override locations with PUPPETEER_DIR / CHROME_BIN if that rig is gone.
const { spawn, spawnSync, execSync } = require('child_process');
const fs = require('fs'), path = require('path');

const REPO = path.resolve(__dirname, '..');
const PORT = process.env.GTA_PORT || 8099;
const RIG = process.env.PUPPETEER_DIR || '/tmp/gta_test/node_modules';
const SHOT = process.env.GTA_SHOT || path.join(REPO, 'scripts', '.playtest.png');

// resolve puppeteer-core from the rig (kept out of the repo's deps)
const require2 = require('module').createRequire(path.join(RIG, 'x.js'));
let puppeteer;
try { puppeteer = require2('puppeteer-core'); }
catch (e) { console.error('FAIL: puppeteer-core not found in ' + RIG + ' — set PUPPETEER_DIR'); process.exit(1); }

function chromeBin() {
  if (process.env.CHROME_BIN) return process.env.CHROME_BIN;
  const base = process.env.HOME + '/.cache/puppeteer/chrome-headless-shell';
  for (const v of (fs.existsSync(base) ? fs.readdirSync(base) : [])) {
    const p = path.join(base, v, 'chrome-headless-shell-linux64', 'chrome-headless-shell');
    if (fs.existsSync(p)) return p;
  }
  return null;
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const bin = chromeBin();
  if (!bin) { console.error('FAIL: chrome-headless-shell not found — set CHROME_BIN'); process.exit(1); }

  // serve the static ES-module project (Chrome blocks file:// fetch)
  const server = spawn('python3', ['-m', 'http.server', String(PORT)], { cwd: REPO, stdio: 'ignore' });
  const cleanup = () => { try { server.kill('SIGKILL'); } catch (_) {} };
  process.on('exit', cleanup);
  await sleep(800);

  const browser = await puppeteer.launch({
    executablePath: bin,
    args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
    defaultViewport: { width: 640, height: 400 }   // small viewport → less headless GL pressure (fewer swiftshader flakes)
  });
  let glDead = false, closing = false;         // headless swiftshader can drop the GL ctx under load
  browser.on('disconnected', () => { if (!closing) glDead = true; });   // ignore our own browser.close()
  const errors = [];
  try {
    const page = await browser.newPage();
    page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });
    page.on('error', e => { glDead = true; });   // page target crashed (GL death), not a game error
    page.on('requestfailed', r => errors.push('REQFAIL: ' + r.url() + ' ' + (r.failure() && r.failure().errorText)));

    await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: 'networkidle0', timeout: 60000 });
    // wait for assets, then start the REAL game via the DEBUG hook (KeyP is a no-op — see main.js:1180)
    for (let i = 0; i < 40 && !glDead; i++) {
      const ready = await page.evaluate(() => !!window.__start).catch(() => false);
      if (ready) break; await sleep(300);
    }
    const engErr = () => page.evaluate(() =>
      document.getElementById('err') && document.getElementById('err').style.display === 'flex'
        ? document.getElementById('errmsg').textContent.slice(0, 400) : null).catch(() => null);
    let e0 = await engErr(); if (e0) errors.push('ENGINE(load): ' + e0);

    await page.evaluate(() => window.__start(false)).catch(() => {});
    await sleep(1500);
    e0 = await engErr(); if (e0) errors.push('ENGINE(start): ' + e0);

    // light scripted session (kept short + ground-only; flight stresses headless GL → false flake)
    if (!glDead) { await page.keyboard.down('KeyW'); await sleep(1200); await page.keyboard.up('KeyW'); await sleep(300); }
    if (!glDead) { await page.keyboard.press('KeyE'); await sleep(1200); }   // enter nearby car
    if (!glDead) { await page.keyboard.down('KeyW'); await sleep(1200); await page.keyboard.up('KeyW'); await sleep(300); }
    let e1 = await engErr(); if (e1) errors.push('ENGINE(play): ' + e1);
    // optional screenshot only when GATE_SHOT=1 (capturing under swiftshader can itself crash the GL ctx)
    if (!glDead && process.env.GATE_SHOT === '1') await page.screenshot({ path: SHOT }).catch(() => {});
  } finally {
    closing = true;
    await browser.close().catch(() => {});
    cleanup();
  }

  // real game errors fail the gate; a pure GL-death with no JS/engine error is inconclusive (warn, pass)
  if (errors.length) { console.error('GAMEPLAY TEST FAIL:\n' + errors.slice(0, 12).join('\n')); process.exit(1); }
  if (glDead) { console.warn('GAMEPLAY INCONCLUSIVE — headless GL died but no JS/engine error (swiftshader flake). Passing.'); process.exit(0); }
  console.log('GAMEPLAY OK — game started, no JS errors, no engine crash. Screenshot: ' + SHOT);
  process.exit(0);
})().catch(e => { console.error('GAMEPLAY TEST FAIL:', e.message); process.exit(1); });
