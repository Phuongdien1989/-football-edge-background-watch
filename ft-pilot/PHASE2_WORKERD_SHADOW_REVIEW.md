# Football Edge — FT Data Capture Pilot: Phase 2 Workerd Shadow Acceptance
23/10/2026 · **Review only** · Draft PR #16 · NO production changes

## What is actually validated
- [Local Workerd/Miniflare + SQLite D1/DO CI](https://github.com/Phuongdien1989/-football-edge-background-watch/actions/runs/39926508542): **SUCCESS**, `FE_FT_PILOT_WORKERD_SHADOW_PASS` **36 assertions**.
- Exact modules exercised: `ft-pilot/recorder.mjs`, `ft-pilot/integration.mjs`, `ft-pilot/schema-candidate.sql`, `ft-pilot/shadow-worker.mjs`. Workerd executes the real Durable Object transaction and D1 prepared-query interfaces, without ANY production Cloudflare credentials, scanner, provider API, or Push.
- Local D1 inserts **exactly five unique fixtures**, a mix of `RECOMMENDATION_CANDIDATE` and `NOT_RECOMMENDED` (including a missing-statistics case), and blocks a sixth fixture. The captured odds JSON is the original supplied test source, not an AI reconstruction.
- Restart via `Miniflare.setOptions` and D1 proxy reacquisition preserved all five rows plus pre-reserved `DO` SQL/write-token counters; duplicate fixture after restart added no pair.
- Candidate table UPDATE/DELETE triggers were verified by the **actual local D1 SQL implementation**, not only ordinary Python SQLite: both were rejected, and original stored pair content/hashes remain.
- `FT` outcome is taken from an already supplied local event; a corrected fulltime score appends a second version, the third is blocked. No independent polling or extra API calls.
- With the feature flag OFF in a fresh local D1 without the schema, dispatch is `DISABLED`, schema remains absent and no FT write occurs.
- When local D1 schema is intentionally absent **with flag ON**, the event handler returns normally while FT sidecar records a durable pause; there is no scanner, Push or HT/HC to disrupt.
- [Real inherited notifyTick/actual H1/FT/HC engines dual replay](https://github.com/Phuongdien1989/-football-edge-background-watch/actions/runs/39925071847): 21 before/after cases, identical legacy stored state and Push packets in local fixtures. Tests run the existing `uiStatePacket` and `fromBridges` Mobile adapters; only the supplied source TOP ranks, NOT the full independent ranking engine, are compared. Original production source files unchanged.
- Earlier gate: `ft-pilot/test.mjs` SQLite tests 24/24, `ft-pilot/test-integration.mjs` 17/17, Mobile HT asset guard 20/20.

## Precision on billed resource and runtime equivalence
- Local D1 `meta.rows_read/rows_written` is checked and logged at each operation; INSERTs in the bounded Workerd test reported one local `rows_written` each. These counters **do not certify actual Cloudflare Free billed usage**, concurrency behavior or index amplification under deployed load.
- `miniflare@4` test runner currently supports compatibility date through 2026-08-06; local test explicitly uses 2026-08-01. Production Wrangler specifies `compatibility_date='2026-09-11'`. This **mismatch is a release blocker for a claim of exact runtime equivalence**. A future up-to-date full staging runner or explicitly authorized isolated Cloudflare staging deployment is needed to clear it.
- Workerd shadow fixture is isolated `FTPilotShadowDO`, **not the full production `BackgroundWatcher` chain under operational DO concurrency and real I/O**. Real-evaluator dual replay is separate Node execution of inherited notifier. These two tests together raise confidence but are **not an end-to-end integrated production acceptance**.
- Local elapsed time is recorded in `ft-audit-output/ft-pilot-shadow/report.json`, but **real Worker CPU/p95, provider quota, DO storage cost, mobile TOP/valuation and Push delivery are unmeasured**.
- No unapproved production writes/schema/migrations, no scanning, no Cloudflare worker deployment and no Mobile/HT/HC edit.

## Release-gate status (not permission to deploy)
| Gate | Evidence | Decision |
|---|---|---|
| Default-OFF and no new provider calls | Local Workerd + Node dual replay | PASS offline |
| 5 unique fixture cap, idempotence after restart, two Outcome versions | Actual Workerd D1/DO SQLite | PASS local |
| HT/HC engine and observed Push data parity | Actual inherited notifier in deterministic Node replay | PASS simulated input |
| HT pricing assets unchanged | 28-file static Mobile scope guard | PASS offline |
| Billed D1 Free rowsRead/rowsWritten at full runtime incl index | Not observed in production | UNKNOWN |
| Production CPU p95/p99, DO contention and Push latency | Not observed | UNKNOWN |
| Exact `2026-09-11` runtime behavior | Local Workerd date `2026-08-01` | UNKNOWN |
| Real Outcome coverage of five selected fixtures | No real collection | UNKNOWN |
| Production full TOP/valuation and UI visual regression with FT ON | No production A/B | UNKNOWN |
| Validated total-goals PMF, fair odds, EV and FT V2 FINAL picks | Deliberately disabled | BLOCKED |

## What is next without production modifications
1. Optionally validate the exact deployed compatibility date on a supported newer local `workerd`, or prepare a **separate isolated staging** Worker+DO+D1 configuration (unique names and resources) for explicit future approval. Never point shadow at the production D1 UUID.
2. Prepare a **read-only production baseline report** with exact existing backend/HT/HC TOP/Push/source version + resource counters immediately before any authorized staging; do not run live scans.
3. If a staging cloud deployment is separately approved, run FT OFF/ON parity and latency/load tests, with hard fail/rollback thresholds. Verify no HTTP producer calls and account-wide D1 budget.
4. Only after production preflight and explicit user approval provision the isolated FT pilot tables and FT_PILOT_DB binding with flag OFF, then separately approve the 5-fixture live pilot.
5. Leave collected outcome pending if existing evidence fetch callbacks do not cover that fixture. Do not add API polling silently.

**Checkpoint statement:** Phase 2 local Workerd shadow PASSED; safe production rollout not yet proven. All candidate implementation remains under `ft-pilot/` on Draft PR #16; original Worker/runtime/HT/HC/Mobile production unchanged.
