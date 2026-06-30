id: PROP-001
title: GitHub Actions CI — run lint + headless gameplay gate on every PR
phase: 2
depends_on: none
status: done
attempts: 0
acceptance:
 - A workflow at .github/workflows/ci.yml runs on pull_request to main.
 - It runs the lint (node --check on src/main.js) and the gameplay gate (node scripts/playtest.cjs), installing chrome-headless-shell + puppeteer-core in the runner (PUPPETEER_DIR/CHROME_BIN are overridable in playtest.cjs — use them).
 - The job fails red when playtest.cjs exits non-zero (real JS/engine error) and passes on the inconclusive GL-flake path.
 - A README or tracker note documents that the loop's `ship` step can now watch real CI (`gh pr checks --watch`).
files: [.github/workflows/ci.yml]
notes: |
  Closes the validated gap: the repo has NO CI, so the loop currently self-merges on
  the LOCAL gate only. Adding CI gives `ship` a real remote gate before merge. The
  runner has a GPU-less environment → swiftshader, same as local, so keep the gate's
  inconclusive-GL-death-passes behavior. Headless chrome install in CI is the tricky
  part — the system lacks unzip locally, but ubuntu-latest runners have it; use the
  standard puppeteer browser install or apt. Keep the workflow minimal.
