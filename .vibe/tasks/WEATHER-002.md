id: WEATHER-002
title: Thunderstorm — lightning flashes + thunder during heavy rain
phase: 7
depends_on: none
status: done
attempts: 1
acceptance:
 - While rainF > .8 (full rain), random lightning strikes every ~8-25s (timer sampled per strike, like rainDur).
 - A strike = 1-2 frame white-out flash of the sky/ambient (briefly lift scene.background toward white and boost hemi intensity, then revert — implement as a flash factor 0..1 that decays fast, multiplied into the existing per-frame sky block; must not fight tod or rainF, purely additive/multiplicative on top).
 - Thunder: a low rumble via the existing WebAudio setup 0.5-2s after the flash (distance illusion). Guard with if(actx) like all audio; skip silently when audio is unavailable (headless).
 - No new draw calls, no allocations per frame; flash is color/intensity math only.
 - Works with the RAIN cheat: force rain on, wait, see flashes.
 - Game boots clean; node scripts/playtest.cjs passes and CI is green.
files: [src/main.js]
notes: |
  rainF/rainDur/rainPhase from WEATHER-001 (~1279, state machine in animate ~2530).
  Sky block: skyCol lerp + rain dimming ~2895 — apply flash there:
  skyCol.lerp(white, flash) after the rain dim; hemi.intensity already has a rainF
  factor — add *(1+flash*3) clamped. flash decays: flash*=Math.pow(.75,dtF).
  Thunder: see engine/audio init (actx, eng.g) — a short noise burst through a lowpass
  or a low oscillator sweep, gain ramp down over ~1.5s; schedule with setTimeout after
  the flash. Always guard if(actx&&eng.g). Keep compact style; one PR.
