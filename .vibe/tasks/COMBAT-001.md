id: COMBAT-001
title: Hitmarker + hit sound when player bullets connect
phase: 5
depends_on: none
status: in_review
attempts: 3
acceptance:
 - When a PLAYER bullet hits a person (ped, gang member, foot cop, cop walker) or a cop cruiser, the on-screen crosshair `#xh` (src/main.js ~line 1284 toggles it) gives a brief hitmarker flash (~150ms): scale up + white tint, and RED tint when the hit is a kill/decap (downPed/decapPed/killGang/decapGang/cop removed/cruiser exploded).
 - A short percussive "hit" tick sound plays on connect (WebAudio, like gunSound ~line 1143 / chime ~line 1151); ALWAYS guard audio with if(actx) like existing sound helpers.
 - No hitmarker for bullets that hit walls/props/AI traffic or expire; no hitmarker for cop bullets.
 - Implement as a small helper (e.g. hitMark(kill)) called from the player-bullet hit branches in the bullet loop (src/main.js ~lines 2733-2775); style the flash via inline style/CSS on #xh (its element lives in index.html) with a timer variable decayed in the main loop or a setTimeout — keep it simple and allocation-free per frame.
 - Purely visual/audio; no gameplay/damage changes. Game boots clean; node scripts/playtest.cjs passes; CI green.
files: [src/main.js, index.html]
notes: |
  Today hits only spawn world blood/sparks — at range you can't tell you connected.
  The bullet loop's player branch (~2733) has distinct hit cases: peds (~2736, downPed/
  decapPed = kill), gangs (~2742, killGang/decapGang = kill), copWalkers (~2749, always
  kill), footCops (~2754, always kill), cruisers (~2761, kill only when hp<=0 explode).
  Call hitMark(true|false) in each. Match compact style; keep files <500 new lines (tiny).
