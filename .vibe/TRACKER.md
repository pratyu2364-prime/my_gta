# my_gta — Build Tracker

Source of truth for the autonomous loop. A fresh `/ship` session resumes from this file.

## Control panel
- **Mode:** autopilot + `/loop` (self-merge on green CI + gameplay test, no approvals)
- **Workers:** opencode / claude-sonnet (escalate: add hermes/grok in config.yml)
- **Reviewer:** Opus (every diff vs task acceptance)
- **Gameplay gate:** `node scripts/playtest.cjs` must pass before any merge
- **On empty:** Opus proposes a new task batch and continues (`on_empty: propose`)
- **Paused:** no

## Legend
`todo` ready · `in_progress` worker coding · `in_review` PR open / CI · `done` merged + deployed · `failed` retry pending · `blocked` exceeded retry_cap

## Board
| id | title | phase | depends_on | status | attempts | PR |
|----|-------|-------|-----------|--------|----------|----|
| QA-001 | Race only pays out if the player actually raced | 1 | none | done | 3 | #2 |
| QA-002 | Enter prompt verb matches vehicle type (drive vs ride) | 1 | none | done | 1 | #3 |
| PROP-001 | GitHub Actions CI — lint + headless gameplay gate on PRs | 2 | none | done | 4 | #5 |
| TERRAIN-001 | Deliberate, well-spaced river bridges (not random/sparse) | 3 | none | done | 1 | #7 |
| TERRAIN-002 | Natural rolling hills replace the cone-mountain ring | 3 | none | done | 1 | #8 |
| LIFE-001 | Explosions/loud events scatter the crowd | 4 | none | done | 1 | #11 |
| LIFE-002 | Day/night crowd density — sparser at night | 4 | none | done | 1 | #12 |
| LIFE-003 | AI traffic lights its brake lights when braking | 4 | none | done | 1 | #14 |
| ECON-001 | Gun shop landmark — buy weapons & ammo with cash | 5 | none | done | 1 | #20 |
| WEATHER-001 | Rain weather — periodic rain with visuals + wet handling | 5 | none | done | 3 | #21 |
| POLICE-001 | Wanted escalation tiers — police pressure scales with stars | 5 | none | done | 1 | #22 |

## Activity log
- 2026-07-14 — POLICE-001 **done** (PR #22, green CI, merged). grok-4.3 single clean attempt: 3★ ram+1.15 speed, 4★ fireT .45/dmg 16, cruiser cap 2/3/4/5 by tier. Board clear — phase-5 batch complete.
- 2026-07-14 — WEATHER-001 **done** (PR #21, green CI). big-pickle failed 2× (opencode server errors) → grok-4.3 delivered; Opus review fixed grip>1 amplification bug, added fog/light rain dimming, fixed per-frame-random state machine. User approved merge (classifier blocked self-merge).
- 2026-07-11 — Board was empty → `on_empty: propose`: queued phase-5 batch ECON-001 (gun shop landmark, buy weapons/ammo), WEATHER-001 (rain cycles + wet handling + RAIN cheat), POLICE-001 (wanted escalation tiers 3/4/5★). Grounded in code: no weather/shop system exists; copWalkers fire block ~1692, cheats ~1384, LM array ~351.
- 2026-07-01 — `.vibe/` scaffolded (autopilot, opencode+sonnet workers, headless gameplay gate). Awaiting first `/align`.
- 2026-07-01 — Autonomous loop (on_empty=propose): LIFE-001 **done** (#11, explosions+enemy gunfire scatter crowd) + LIFE-002 **done** (#12, day/night crowd density). Both grok-4.3, single attempt, green CI. Pre-checked existing code (gunfire already scared peds via scarePeds) to avoid duplicate work.
- 2026-07-01 — TERRAIN-001 **done** (PR #7, green CI) + TERRAIN-002 **done** (PR #8, green CI). Both grok-4.3, single clean attempt each. Bridges now ~2-4 well-spaced crossings with real approaches; hills are jittered icosahedron forms (verified on horizon screenshot). Board clear.
- 2026-07-01 — `/align` (world life → terrain): queued TERRAIN-001 (deliberate well-spaced bridges; current river.cross is arbitrary→sparse) + TERRAIN-002 (natural rolling hills replacing cone-mountain ring, decorative). Hills scoped to look-only (drivable hills deferred — flat-ground architecture). Awaiting sign-off.
- 2026-07-01 — PROP-001 **done** (PR #5, merged on GREEN CI — first real remote gate). Worker grok-4.3 created then self-deleted the file → authored directly. CI fixed across 4 runs: invalid npm dir name `.citest`→`citest`, then channel-alias 404 (node install API doesn't resolve `stable` → switched to `@puppeteer/browsers` CLI + pipefail). Final: chrome installs + gameplay gate passes in 55s.
- 2026-07-01 — Board emptied (QA-001/002 done) → `on_empty: propose`: queued PROP-001 (remote CI, validated gap). Gameplay proposals await user sign-off.
- 2026-07-01 — QA-002 **done** (PR #3, merged). Worker xai/grok-4.3, single clean attempt. Gate: lint OK + gameplay OK.
- 2026-07-01 — QA-001 **done** (PR #2, merged). Worker big-pickle failed 2× (opencode server errors err_4f50833b/err_3716fb04) → escalated to xai/grok-4.3, which produced a clean minimal fix. Gate: lint OK + gameplay OK. attempts=3.
- 2026-07-01 — QA sweep (Opus): probed every system headless (boot, on-foot, weapons, talk, carjack/drive, wanted+police, vigilante; full code review of missions/economy/death). **Zero JS/engine-crash bugs — game is crash-robust.** Headless "crashes" were swiftshader GL deaths under simultaneous heavy load (test-env only, no JS error). Validated 2 real minor issues → QA-001 (race payout exploit), QA-002 (drive/ride wording). Dropped 2 false positives (foot-speedo km/h and knife-at-spawn are both intentional). Fixed test infra: gameplay gate now starts the real game via `__start` (was a no-op `KeyP`) and fail-fasts on browser death instead of hanging to timeout.
