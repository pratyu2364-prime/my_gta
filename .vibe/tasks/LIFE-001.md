id: LIFE-001
title: Explosions and other loud events scatter the crowd
phase: 4
depends_on: none
status: done
attempts: 0
acceptance:
 - explode(p) (src/main.js ~line of `function explode`) calls scarePeds(p.x,p.z,R) with a larger radius than gunfire (R ~28-32) so peds within blast range bolt away.
 - Non-player gunfire also scares nearby peds: shoot() currently only scares when from==='player' — extend so cop/gang gunfire (from!=='player') also calls scarePeds with a modest radius (~10). Do NOT make peds flee their own bullets in a way that breaks gang/cop logic — just the civilian crowd (scarePeds already skips down/talk peds).
 - No regressions: scarePeds already exists and is safe (skips down/talk, never splices peds). Game boots clean.
 - node scripts/playtest.cjs passes and CI is green.
files: [src/main.js]
notes: |
  scarePeds(x,z,r) (defined ~line 1317) already sets nearby walking peds to state='flee'.
  Gunfire wires it (shoot → scarePeds(x,z,15) for player only). The gaps: explode() does
  NOT scare the crowd at all, and enemy gunfire doesn't either. Small, surgical: add a
  scarePeds call in explode() and broaden the shoot() condition. Keep compact style; don't
  touch the particle/light code in explode.
