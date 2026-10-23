# FT Pilot Phase 3 — pre-approval, exact-date local runtime & staging isolation
Checkpoint 23/10/2026 · Draft PR #16 · review-only; NO deploy.

## Prior PASS retained
- Baseline `ed9251946b9f9bcf8569a5258585964780dc3eca`: review CI 39926762374, foundation 39926762361, Workerd CI 39926762363 all SUCCESS.
- Node inherited v130 notifyTick and actual H1/FT/HC evaluator dual replay 21/21; isolated Miniflare v4 D1/DO 36 assertions at compatibility_date 2026-08-01; 28 Mobile assets with 10 HT guarded 20/20.
- Real TOP ranker, full v138 operational BackgroundWatcher, HT price valuation and Push delivery NOT yet A/B tested; no production CPU or billed D1 measurements.

## New candidate tests (not a production-safe claim)
- `.github/workflows/ft-pilot-phase3-exact-date.yml` now runs stable `miniflare@4.20260730.0` with explicitly overridden `workerd@1.20261015.1` executable at compatibility date `2026-09-11`. GitHub Actions **39930806060 SUCCESS**: local D1/DO **36/36 assertions PASS** and source-inventory PASS. This clears the local FT shadow date mismatch, not full production parity. Earlier Miniflare 5 beta trials failed at its breaking configuration API and were not counted as runtime acceptance.
- `test-phase3-source-guard.mjs` statically verifies the v138→v137→v136→v135→v132→v131→v130 source lineage, default OFF/unchanged config and unchanged original notifier. This is not full v138 dynamic replay.
- Original v4 job remains intact and runs on its previously supported date; NEVER report its result as equivalence to 2026-09-11.
- No additional provider request, polling/retry, schedule, Cloudflare credential, schema migration, production deployment or scanner action.

## Isolated staging preflight (unapproved)
1. Read production **without mutation**: deployed backend SHA/version, current scanner flag/alarm, preserved 28 Mobile assets including HT valuation, rollback versions, account-wide D1 billed usage/remaining Free quota, DO load, existing Push/TOP baseline. Mark unknown whenever read access is unavailable.
2. At separate Gate A approval, allocate **new** Worker, DO and D1, with separate identifiers, no routes/cron/provider or Push credentials. Do not connect original D1 UUID or existing BackgroundWatcher DO. Shared Cloudflare Free budget is an account-level risk even with isolated D1; check before invoking any cloud tests.
3. Compare full v138 BackgroundWatcher and actual TOP ranker, HT valuation, H1/HC/FT scoring, existing Push formatter and Mobile adapters before/after **on identical pre-recorded responses and controlled clock**. Capture hashes, rankings, cards, queue/push bytes, status and cooldown, and ensure zero added source request attempts.
4. Stress independent FT recorder OFF→ON in staging only with concurrency, restart, duplicate callbacks, five-pair cap, class caps, two Outcome revisions, schema/budget error, waitUntil failure, and pending final results; no added outcome polling.
5. Measure CPU p50/p95/p99, D1 billed rowsRead/rowsWritten including indexes/triggers, DO read/write and Push latency. Local counters do not certify account billing.
6. STOP if any HT/HC/TOP/Push output differs, added provider request occurs, scanner/alarms/cooldowns change, OFF causes writes, or shared budget deteriorates; FT must fail closed. Do not extrapolate safe production rollout from standalone FTPilotShadowDO success.

## Three independent approvals
- **A** isolated cloud staging & quota envelope — NOT AUTHORIZED.
- **B** production schema/binding + OFF backend flag, fresh rollback & QA — NOT AUTHORIZED.
- **C** enable 5-fixture capture with source reuse, new explicit approval — NOT AUTHORIZED.

Candidate remains 5 unique fixtures (recommended and not), one immutable pair each, max two revisions per fixture, 60 reserved FT SQL, 240 reserved write tokens (NOT a billing ceiling). Outcome may remain PENDING. FT V2 real fair odds, PMF calibration, EV and final recommendations remain OFF.

## Phase 3 verified runtime and remaining blockers — 23/10/2026

- Exact-date local Workerd CI: https://github.com/Phuongdien1989/-football-edge-background-watch/actions/runs/39930806060 — SUCCESS at source commit `c00871ca40964708acdaa8ba1b08168cac7dbceb` (two jobs SUCCESS).
- 36 local assertions: five distinct pair cap, two sample classes, D1/DO persistence/restart, immutability triggers, two Outcome versions, OFF and D1 fail-closed. **No remote production measurements**.
- HT 28-asset restoration PR #17 was OPEN/DRAFT when checked on 23/10/2026. Static guard 20/20 PASS cannot certify the currently deployed Mobile release.
- **UNKNOWN:** full v138 BackgroundWatcher A/B, real TOP algorithm and HT fair-value display, production CPU p95/p99 and Push latency, account D1 Free billing/index amplification, DO under load and actual Outcome callback coverage. No staging cloud resources were created.
- **NOT AUTHORIZED:** Gate A staging cloud, Gate B production schema/binding OFF, Gate C live five-fixture capture. FT V2 fair odds/EV/FINAL still OFF.
