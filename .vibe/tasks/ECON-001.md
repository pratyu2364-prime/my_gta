id: ECON-001
title: Gun shop landmark — buy weapons & ammo with cash
phase: 5
depends_on: none
status: done
attempts: 1
acceptance:
 - A 4th enterable landmark "GUN SHOP" exists (type 'gunshop'), built like the other 3 (walls with doorway gap, sign, interior light, minimap blip with its own colour in LM_COL).
 - Standing inside the shop, the player can buy: pistol ($400), uzi ($900), shotgun ($1200), and an ammo refill for the currently held gun ($150 → refills to that weapon's ammo0). Purchases deduct money, grant the weapon/ammo, play the chime, and show a showMsg confirmation.
 - Insufficient funds → showMsg rejection (e.g. "Not enough cash"), nothing granted, money unchanged.
 - Buying a weapon already owned only refills its ammo (no duplicate owned entries).
 - Purchase interaction must NOT break the existing edge-triggered E carjack/enter flow; use a separate key or only consume E when inside the shop zone with no vehicle prompt active.
 - Owned weapons/ammo persist via the existing progression auto-save (owned/ammo are already in saveProgress — no save changes needed, just verify).
 - Game boots clean; node scripts/playtest.cjs passes and CI is green.
files: [src/main.js]
notes: |
  Landmarks: LM array at src/main.js ~351 (3 entries), chooser loops at ~356-358 use
  chosen.length<3 — bump to 4 and add the gunshop cfg (dark bg, yellow fg works).
  Minimap colours: LM_COL ~2361 (add gunshop entry). checkLandmarks already tracks
  insideLM per landmark and heals for hospital/food — add a gunshop branch that shows
  a shop prompt (#prompt div) listing prices and reads number keys or E.
  CAREFUL: Digit1..4 already switch weapons (weapon select) — either use different keys
  (e.g. KeyB cycles offer + KeyE buys) or suppress weapon-switch while inside the shop.
  WEAPONS table ~1272 has ammo0 per gun; giveWeapon-style logic exists at ~1288
  (owned.push + curW). money is a plain let at ~1262. Keep compact style; one PR.
