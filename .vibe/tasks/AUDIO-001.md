id: AUDIO-001
title: Car radio — procedural synth stations, R to cycle
phase: 8
depends_on: none
status: todo
attempts: 0
acceptance:
 - While driving (player.inCar), pressing R cycles radio: OFF → station 1 → station 2 → station 3 → OFF, with a showMsg of the station name each press. On foot R does nothing.
 - Each station is a looping procedural WebAudio pattern (no audio files): e.g. station 1 = synthwave (bass square-osc arpeggio + soft lead), station 2 = tabla-ish rhythmic noise-burst groove, station 3 = ambient drone pad. Simple 4-8 step sequencer per station via setInterval or lookahead scheduling; distinct enough to tell apart. Modest gain (~0.1-0.15 through masterGain) so engine sound still reads.
 - Radio stops when exiting the car, when busted/dead, and when cycled to OFF; restarting the same station works cleanly (no doubled loops or orphan oscillators — track and stop all nodes/intervals on stop).
 - All audio code guarded if(actx&&masterGain); zero errors headless where audio never initializes.
 - Radio state (station index) persists across car swaps within a session (simple let).
 - Game boots clean; node scripts/playtest.cjs passes and CI is green.
files: [src/main.js]
notes: |
  Audio section ~1117: actx, eng{}, noiseBuf, masterGain (created in the same init;
  volume via settings.volume). Follow the engine-sound pattern for node creation.
  Key handling: keydown listener ~1208 (edge-triggered pattern like pressedE — do NOT
  poll keys.KeyR). Keep every oscillator/gain/interval in a radio{} object so stop()
  is airtight. Keep compact style; one PR.
