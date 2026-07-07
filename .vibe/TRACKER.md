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
| COMBAT-001 | Hitmarker + hit sound when player bullets connect | 5 | none | in_review | 3 | #16 |
| COMBAT-002 | Wanted escalation — 4-5 star response actually escalates | 5 | COMBAT-001 | in_review | 1 | #17 |
| COMBAT-003 | AI traffic takes bullet damage and can be destroyed | 5 | COMBAT-002 | in_review | 1 | #18 |

## Activity log
- 2026-07-07 — COMBAT-001/002/003 built as a STACKED PR chain (#16 → #17 → #18), all lint+playtest green locally; #16 green on remote CI (#17/#18 get CI when retargeted to main on merge). big-pickle failed 2× (server errors err_7632173f/err_6e4c6ede) → grok-4.3 for all three. Review fixes by Opus: kill-flag on always-fatal cop hits (001), dead cruiser-cap condition + 1-3★ preserved (002), invalid `(x??=40)-=d` SyntaxError (003 — worker claimed "syntax OK"). **Self-merge DENIED by Claude Code auto-mode classifier** (merge-without-human-review) despite autopilot config — merges need the user: merge #16, then #17 (auto-retargets), then #18, in order.
- 2026-07-07 — Board empty → `on_empty: propose`: queued phase 5 (combat & police AI): COMBAT-001 (hitmarker/hit-sound feedback), COMBAT-002 (real 4-5★ escalation: cruiser count/speed, fire rates), COMBAT-003 (destructible AI traffic). Grounded in code audit: hits give no feedback, stars 3-5 identical, traffic indestructible.
- 2026-07-01 — `.vibe/` scaffolded (autopilot, opencode+sonnet workers, headless gameplay gate). Awaiting first `/align`.
- 2026-07-01 — Autonomous loop (on_empty=propose): LIFE-001 **done** (#11, explosions+enemy gunfire scatter crowd) + LIFE-002 **done** (#12, day/night crowd density). Both grok-4.3, single attempt, green CI. Pre-checked existing code (gunfire already scared peds via scarePeds) to avoid duplicate work.
- 2026-07-01 — TERRAIN-001 **done** (PR #7, green CI) + TERRAIN-002 **done** (PR #8, green CI). Both grok-4.3, single clean attempt each. Bridges now ~2-4 well-spaced crossings with real approaches; hills are jittered icosahedron forms (verified on horizon screenshot). Board clear.
- 2026-07-01 — `/align` (world life → terrain): queued TERRAIN-001 (deliberate well-spaced bridges; current river.cross is arbitrary→sparse) + TERRAIN-002 (natural rolling hills replacing cone-mountain ring, decorative). Hills scoped to look-only (drivable hills deferred — flat-ground architecture). Awaiting sign-off.
- 2026-07-01 — PROP-001 **done** (PR #5, merged on GREEN CI — first real remote gate). Worker grok-4.3 created then self-deleted the file → authored directly. CI fixed across 4 runs: invalid npm dir name `.citest`→`citest`, then channel-alias 404 (node install API doesn't resolve `stable` → switched to `@puppeteer/browsers` CLI + pipefail). Final: chrome installs + gameplay gate passes in 55s.
- 2026-07-01 — Board emptied (QA-001/002 done) → `on_empty: propose`: queued PROP-001 (remote CI, validated gap). Gameplay proposals await user sign-off.
- 2026-07-01 — QA-002 **done** (PR #3, merged). Worker xai/grok-4.3, single clean attempt. Gate: lint OK + gameplay OK.
- 2026-07-01 — QA-001 **done** (PR #2, merged). Worker big-pickle failed 2× (opencode server errors err_4f50833b/err_3716fb04) → escalated to xai/grok-4.3, which produced a clean minimal fix. Gate: lint OK + gameplay OK. attempts=3.
- 2026-07-01 — QA sweep (Opus): probed every system headless (boot, on-foot, weapons, talk, carjack/drive, wanted+police, vigilante; full code review of missions/economy/death). **Zero JS/engine-crash bugs — game is crash-robust.** Headless "crashes" were swiftshader GL deaths under simultaneous heavy load (test-env only, no JS error). Validated 2 real minor issues → QA-001 (race payout exploit), QA-002 (drive/ride wording). Dropped 2 false positives (foot-speedo km/h and knife-at-spawn are both intentional). Fixed test infra: gameplay gate now starts the real game via `__start` (was a no-op `KeyP`) and fail-fasts on browser death instead of hanging to timeout.
