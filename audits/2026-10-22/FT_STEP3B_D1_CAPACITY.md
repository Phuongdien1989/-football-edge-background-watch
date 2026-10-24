# Football Edge FT — Bước 3B D1 Free capacity checkpoint (2026-10-22)

## Status
**Remote isolated REST evidence PASS; local capacity/scenario tests PASS. Production release gate remains BLOCKED.**

No production D1 writes, Worker deployment, API-Football call, scanner toggle, TOP/Push/mobile/HT/HC modifications were made in Step 3B. This is the *existing* PR #16 draft branch, not a release.

## Actual measured evidence — not estimates
Isolated D1 test database `fe-ft-replay-audit-39699021468`, GitHub Actions:
https://github.com/Phuongdien1989/-football-edge-background-watch/actions/runs/39699252168

Metrics from its actual `remote-d1-audit.json` (read in run logs and saved in run artifact):

| Remote phase | SQL statements | rows_read | rows_written |
|---|---:|---:|---:|
| OBSERVATION | 4 | 4 | 4 |
| DECISION | 4 | 4 | 4 |
| OUTCOME | 4 | 4 | 4 |
| Exact OUTCOME retry | 2 | 3 | 1 |
| Corrected OUTCOME | 4 | 4 | 4 |
| Indexed discovery page | 1 | 6 | 0 |
| 8 concurrent competing inserts, one winner | 11 | 18 | 4 |

Important: each record's **4 rows written** includes reservation and index maintenance in this isolated remote database. This measured cost can change with different indexes or table contents. The remote test used Cloudflare REST, not a running Worker/DO. Production account metrics and replay coverage are not measured.

## Free-tier provider limits (checked October 22, 2026)
- D1 Free: **50 D1 queries per Worker invocation**, **5,000,000 rows read per day**, **100,000 rows written per day**. The read/write limits are enforced and reset at midnight UTC.
- References: https://developers.cloudflare.com/d1/platform/limits/ and https://developers.cloudflare.com/d1/platform/pricing/ and https://developers.cloudflare.com/changelog/post/2026-09-01-d1-free-tier-limit-enforcement/

## New capacity-planning implementation and CI
- `ft-audit-fix/d1-capacity-analysis.mjs`: pure planning tool using **the measured observation/decision/outcome costs**, explicitly **not** proving real workload.
- `ft-audit-fix/test-d1-capacity-analysis.mjs`: 8 cases against Free limits, deferred fixtures and additional unknown work.
- `.github/workflows/ft-audit-foundation.yml`: includes scenario test and uploads `d1-capacity-analysis.json`.
- CI PASS: https://github.com/Phuongdien1989/-football-edge-background-watch/actions/runs/39736426197
- Preexisting 3A cap: sidecar replay hard cap 24 SQL per simulated invocation, so no more than three new OBSERVATION+DECISION pairs at 8 SQL each **if no other sidecar work runs first**. Does not account for inherited Worker D1 activity. A full 12-fixture batch might defer 9 fixtures; no guarantee they will be captured later.

## Planning scenarios — illustrative, NOT measured real scanning
Assume exactly 12 new candidate fixture observations per cycle, one pair needs 8 SQL and writes 8 rows, full replay budget 24 SQL/cycle, and NO outcome/discovery/index delta/other app writes. These are scenario inputs rather than assertions about current scanner cadence.

| Hypothetical scan schedule | Max new replay pairs/day | Modeled replay rows written/day | Interpreting result |
|---|---:|---:|---|
| 20 sec/cycle × 24 h | 12,960 | 103,680 | **Exceeds** 100k write/day from replay alone |
| 30 sec/cycle × 8 h | 2,880 | 23,040 | Below 100k *for replay alone*, other writes unknown |
| 60 sec/cycle × 8 h | 1,440 | 11,520 | Below 100k *for replay alone*, other writes unknown |
| 20 sec/cycle × 4 h | 2,160 | 17,280 | Below 100k *for replay alone*, other writes unknown |

Because index changes may increase billed rows, none is a certified upper bound. More importantly, the program calculates `releaseGate=BLOCKED` even for apparently low scenario loads: it must not mark production safe from incomplete measurements.

## Blockers for release
1. **Aggregate** per-invocation D1 query count including inherited Worker match state, trial observation, decision, discovery and outcome on actual Worker/DO execution not observed. The trial's 24-query cap leaves at most 26 for other D1 uses **only if those operations are in the same invocation**; runtime boundary must be measured, not assumed.
2. **Account-wide daily** D1 row usage of original app + trial (including indexes and other databases) missing. Cannot verify that all paths stay within 5m read / 100k write.
3. **Deferred coverage**: at full 12 candidates, trial budget allows at most 3 pairs per cycle. Need measured backfill, fairness, and durable identification of skipped observations; do not confuse skipped records with negative forecast.
4. Worker/DO runtime, mobile Card/TOP, Push acceptance, provider freshness and real match outcome ledger validation remain to be demonstrated separately.
5. Free account also has other Worker/DO/CPU/subrequest/budget constraints; isolated D1 rows do not certify the whole system.

## Release decision
Keep `FT_REPLAY_TRIAL_ENABLED`, `FT_OUTCOME_TRIAL_ENABLED`, `FT_OUTCOME_DISCOVERY_ENABLED` off for production. Preserve scanner OFF unless user actively enables it. No PR merge. **Do not claim FT AI V2 predictive performance.**

## Proposed next acceptance step
**3C:** audit timestamped replay completeness and output latency, check unobserved TOP/Push distinctions, and design bounded work scheduling for deferred matches; use staged data only. Production enablement requires an explicit owner decision after real aggregate D1 accounting.
