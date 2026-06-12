# Pratyush City — a GTA-style open world in one HTML file

A free-roam crime sandbox in the spirit of classic GTA, written as a **single self-contained
`gta_sim.html`** (three.js r128 from CDN — no build step, no install).

## Run it

Open `gta_sim.html` in any modern browser. From WSL:

```bash
explorer.exe gta_sim.html      # or: wslview gta_sim.html
```

Needs internet on first load (three.js + font come from CDNs). Click or press any key to start.

## Controls

| Key | Action |
|---|---|
| W A S D / arrows | drive / walk |
| E | enter / exit vehicles, **carjack** (walk to door, pull the driver out) |
| SPACE | handbrake — drift |
| SHIFT | nitro boost / sprint |
| CLICK / F | shoot |
| Q | switch weapon |
| H | horn |
| M | full city map |

## Features

- **Asymmetric procedural city** — irregular road grid with partial dead-end streets,
  downtown / midtown / outskirts districts, parks; different layout every load
- **On-foot + vehicles** — cars and motorcycles, all stealable with a proper jack
  sequence (door swings open, driver thrown to the street); drivers/riders are visible
  through glass cabins
- **Wanted system** — up to 5 stars; cruisers flank and pull over, officers step out and
  **bust you at your door**; at 2+ stars they open fire
- **Weapons** — pistol / uzi / shotgun pickups (green blips), drive-bys, destructible cop cars
- **Living traffic** — lane keeping, queuing, working traffic lights, U-turns at dead ends,
  braking for pedestrians and for you; peds flee, get run over, get thrown out of cars
- **Day/night cycle** (~8 min) — sunsets, stars, lit building windows, street lamps,
  real headlight beams
- **Missions** — chained deliveries with cash rewards; GTA-style HUD with rotating minimap,
  zone names, wanted stars, damage vignette, in-game clock
- **Synthesized audio** — engine, tire squeal, gunshots, siren, horn, crashes (Web Audio,
  zero audio files)

## Dev / testing

See [CLAUDE.md](CLAUDE.md) for architecture notes and the headless test harness.
