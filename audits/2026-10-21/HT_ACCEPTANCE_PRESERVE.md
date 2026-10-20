# HT acceptance checkpoint — preserve pre-HT production

Verified at 2026-10-20T20:31:44.591Z. Audit commit: 00253f048a2961b11ddd4784378745102884c75f.
HT code candidate: a9e9cc68cc07af27bdca0305b6f227da12f64cb9.

## Result
PRE-RELEASE CHECKS PASS; full production acceptance remains PENDING.
No production deployment, scanner toggle, database export or rollback execution was performed.

- Verified all 128 manifest-listed package files by SHA-256.
- Verified the 18 original Mobile assets both in backup and against the running public app.
- Preserved 29 original backend source/configuration files.
- Candidate modifies only notify-core-h1.js and worker_notify_v130.js among existing backend files; new helpers are additional files.
- Wrangler configuration unchanged.
- Confirmed all three pre-HT versions exist and are still active at 100%:
  - Mobile shiny-silence-d892: 3c0e47ed-275b-410c-b527-77f1ff65a28a
  - Backend football-edge-background-watch: 04cc044d-412f-4844-9b83-c7c786eedd13
  - Desktop football-edge-desktop-b2-test: a332ee39-abb2-422d-a021-db78ef19cc10
- Backend health and commit da5242bb41b2401271f52dda17b0e2208e7e3819 verified.
- D1 binding unchanged, no scheduled cron.

## Live state discovered
Scanner is ON (enabled=true, manualEnabled=true), with an existing next_alarm.
Do not rely on the older OFF checkpoint. Do not switch production backend or silently stop the user's scan during this acceptance step.

## Evidence
[Acceptance workflow](https://github.com/Phuongdien1989/-football-edge-background-watch/actions/runs/39492709945)
[Acceptance JSON](https://github.com/Phuongdien1989/-football-edge-background-watch/actions/runs/39492709945/artifacts/12296955714)
[Candidate ZIP including old source/assets](https://github.com/Phuongdien1989/-football-edge-background-watch/actions/runs/39491133238/artifacts/12296196931)
The candidate archive retention is 30 days from its original run. Download it for a long-term independent copy.
This archive is not a D1 database backup and does not contain secrets.

## Recovery procedure for a later approved rollout
Record the exact active versions again immediately before rollout; refuse if drifted.
Preserve existing bindings, secrets and data; do not apply unrelated migrations.
On a candidate regression, select the corresponding PRE-HT version above in that Worker's Deployments and restore 100% traffic. Restore Mobile and backend independently if both were changed. Desktop must remain untouched.
Then verify active version, backend /health commit, Mobile asset hashes and scanner state; do not automatically turn scanner ON.
Old-version existence has been verified; an actual production rollback drill was NOT performed.

## Still needed before main release
- Authenticated candidate team-history warm-up and data synchronization with real provider responses.
- Actual iPhone/PWA behavior and end-to-end Push receipt. Synthetic browser tests or push transport acceptance cannot prove device receipt.
- Candidate account-wide quota measurements under real traffic.
- Safe release window with scanner confirmed stopped by the user, or a separately approved isolated live test environment.
No claim of forecast accuracy or profitability is made.
