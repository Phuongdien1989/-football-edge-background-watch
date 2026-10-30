# FT Pilot — Phase 1: before/after HT/HC/FT acceptance report (2026-10-23)

**Status: OFFLINE SOURCE-REPLAY PASS, PRODUCTION ACCEPTANCE PENDING.**
This checkpoint belongs to draft [PR #16](https://github.com/Phuongdien1989/-football-edge-background-watch/pull/16). No app deployment, no Worker version upload, no schema migration, no scanner activation or D1 Cloudflare queries/writes during this verification.

## What was actually compared
The latest [FT Pilot review CI](https://github.com/Phuongdien1989/-football-edge-background-watch/actions/runs/39924888178) executes **real inherited v130 `notifyTick()` and the unmodified `notify-core-h1.js` H1/FT/HC evaluator** in local Node modules, using the same deterministic provider responses and fixed receive clock.

- **7 scenarios × 3 modes = 21/21 identical before/after replay outcomes**.
- Scenarios: 1H with HT+HC data, 2H FT+HC with odds history, missing second-half statistics, live odds provider failure, stats provider failure, score-change/cooldown reset, rejected Push transport.
- Modes: `FT_PILOT_ENABLED=false`, enabled with injected FT-only D1 failure, enabled with Durable Object FT SQL/write budget already exhausted.
- Deep comparisons include the **whole legacy persisted notify:match state**, `notify:status`, `notify:budget`, ordered provider API request/arguments, and ordered Push packet payloads and transport acceptance requests.
- Live UI source output is independently checked through **actual `uiStatePacket()`** and **actual `fromBridges()` tabs display adapter**. Ranked TOP is provided as an identical *mock-existing* ranking input on both sides; this verifies adapter preservation, **not the complete production TOP computation**.
- Out of seven baseline scenarios, **3 scenarios emitted Push attempt packets**, which were proven identical.
- The simulation injects errors into an isolated FT sidecar, not into the real source scorer. The change itself is the review-only patch source from `build-review-patch.mjs`. The original `worker_notify_v130.js`, `worker.js`, `wrangler.toml`, `notify-core.js`, `notify-core-h1.js` are **not modified**.

## Timing evidence, deliberately limited
Latest local GitHub runner replay recorded:
| Metric | Original | With pilot hook |
|---|---:|---:|
| Median notifyTick wall time (Node local, sampled) | 0.64 ms | 0.63 ms |
| p95 notifyTick wall time (Node local, sampled) | 2.39 ms | 1.56 ms |

Max positive added time in a single comparison: **0.16 ms**. Do **not** infer speedup, production overhead, SLO compliance or a release decision from these tiny non-randomized, in-process samples. Runner noise, Node JIT, mocked I/O and sequential test order invalidate production extrapolation. `waitUntil` sidecar is excluded from the synchronous notifyTick measurement. Actual Cloudflare Worker CPU p95, end-to-end Push latency, DO storage accounting and D1 index-billed read/write rows are **UNKNOWN**.

## Independent pilot bounds and local database verification
- `ft-pilot/test.mjs`: **24/24 PASS with SQLite file and fresh connections**; exactly five distinct fixtures per epoch, 3+2 source classes, one immutable pair per fixture, max two append-only regulation Outcome versions, blocked sixth fixture, duplicate restart denial, pending and corrected result behavior.
- `ft-pilot/test-integration.mjs`: **17/17 PASS**; OFF zero work, nonblocking after-Push hook, rejected waitUntil produces zero FT writes, durable FT-only budget exhausted/restart, errors never throw into HT/HC/Push, exact scanner inheritance v138→v137→v136→v135→v132→v131→v130.
- `ft-audit-fix/test-mobile-asset-isolation.mjs`: **20/20 PASS**; protects 28 current Mobile assets including 10 HT valuation assets.
- The maximum pilot configuration remains: **5 fixtures, 1 pair per fixture, at most 2 Outcome versions per fixture, max 20 KiB per pair, 100 KB pair budget, 60 reserved FT SQL calls and 240 reserved billed-write tokens**, recording windows 4 hours + 72 hours for passive outcomes. **These reservations do not guarantee an absolute Cloudflare billed ceiling**, including writes caused by indexes and D1/DO storage.

## Must-fix or must-measure before any real FT pilot
1. **Integration test coverage is offline and only the v130 inherited notifyTick + pure display adapters.** The entire production Worker v138 chain, REAL Push transports, real Cloudflare DO concurrency, Cloudflare D1 billing and source API availability were NOT A/B exercised under actual runtime load.
2. The actual TOP ranking engine and HT valuation presentation must be compared on a supported, isolated **staging or authorized backend shadow build** with true source inputs (and exact source snapshot/commit parity), without making changes on production. Current adapter test merely keeps given rank/card inputs invariant.
3. Benchmark **p50/p95/p99 Worker CPU and end-to-end scan/Push**, DO read/write volume, billed D1 rowsRead/rowsWritten, index overhead, provider quota. Start with flag OFF. Stop/revert if any HT/HC/Push deviation or shared budget deterioration; never turn FT on to gather data before these checks.
4. **Outcome coverage is not guaranteed**: current `worker.js` `pollEvidence` only receives FT/AET/PEN for fixtures whose existing evidence jobs already fetch them. Do not add dedicated provider polling. Pending Outcome must stay pending, not label a loss.
5. When deployment is separately authorized: inspect actual current rollback, D1 schema and account-wide quota; create ONLY isolated schema/alias with config OFF first. No migration/deploy/activation is authorized by this report.
6. No real calibrated final total-goals PMF, fair odds, EV, FT V2 investment recommendation or production UI release is authorized.

## CI checkpoints
- [Real-engine dual replay review package CI](https://github.com/Phuongdien1989/-football-edge-background-watch/actions/runs/39924888178): SUCCESS.
- [Full FT candidate foundation CI](https://github.com/Phuongdien1989/-football-edge-background-watch/actions/runs/39924888186): check run result when viewing; at checkpoint generation may still be processing.
- Browser/HT assets remain controlled by their existing independent non-regression workflows.

**Phase 1 conclusion:** Code reviewer can inspect an A/B parity candidate package now. To claim production-safe, a separate real runtime acceptance gate is indispensable; no production action has been taken.
