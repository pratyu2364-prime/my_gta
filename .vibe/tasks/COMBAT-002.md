id: COMBAT-002
title: Wanted escalation — 4-5 star response actually escalates
phase: 5
depends_on: COMBAT-001
status: todo
attempts: 0
acceptance:
 - Cruiser count scales with stars instead of the flat 4 cap. Replace `while(cops.length<wanted&&cops.length<4)spawnCop();` (src/main.js ~line 2791) with a cap of Math.min(wanted+1,6) so 5 stars fields 6 cruisers, 1 star still fields ~2.
 - At wanted>=4 foot cops fire faster: fire interval 1.4 -> 0.9s (footCopUpdate ~line 1798-1800); cop walkers likewise 0.7 -> 0.5 (~line 1696).
 - At wanted 5 cruisers get a speed edge: top forward speed 0.95 -> 1.08 in copUpdate (~line 1732, `vf=Math.min(vf+.016*dtF,.95)`) so you can't trivially outrun them.
 - Foot-cop deployment cap rises from 4 to 6 when wanted>=4 (copUpdate deploy condition ~line 1747 `footCops.length<4`).
 - All thresholds read the live `wanted` var; behavior at 1-3 stars is UNCHANGED. No new spawn functions.
 - Game boots clean; node scripts/playtest.cjs passes; CI green.
files: [src/main.js]
notes: |
  Currently 3, 4 and 5 stars feel identical: same 4 cruisers, same fire rate, same speed.
  This is pure constant/threshold work in copUpdate/footCopUpdate/the wanted block —
  keep it minimal, no refactors. HOT cheat (types "HOT") sets 5 stars for manual testing.
