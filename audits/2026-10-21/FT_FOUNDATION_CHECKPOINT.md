# FT foundation checkpoint — 21/10/2026

## Completed
- Candidate commit: 2c463ece2ecf1ff8a6bf236fe8cb143502aec4e6.
- Workflow https://github.com/Phuongdien1989/-football-edge-background-watch/actions/runs/39580365132 passed both candidate and read-only inventory jobs.
- Immutable input artifact 12330995383, baseline commit 3cd210d2d74aff547de4587ab4a3c96b982a728c.
- Baseline candidate hashes verified; reconstructed candidate changes only notify-core.js. All other packaged files, including scan-status recovery, are byte-identical.
- Reproduced two baseline defects; 26 candidate checks PASS and syntax PASS.
- FT market selection now requires normalized category over_under rather than matching half/team markets by text. Missing line stays null instead of Number(null) becoming zero.
- Explicit valid zero/quarter lines and odds 2.90 remain supported.
- No deployment, scanner toggle, provider calls, schema mutation or D1 writes.

## Runtime verification
At 2026-10-21T09:52:58Z (16:52:58 Vietnam), Cloudflare control-plane reads confirmed 100%:
- backend e7d2090c-d0e1-4f58-9f5a-4360acd2ced3
- mobile 3166663f-f039-48f5-92ae-888890bb9455
- desktop a332ee39-abb2-422d-a021-db78ef19cc10
Backend rollback 7e4bb3b7-2dc6-4f0d-8c8a-9d8e6da2440a exists. Health returned baseline deploy commit, scanner OFF, no alarm.

## Actual bounded D1 inventory
Five SELECT queries reported 1,139 rows read and zero rows written.
- fixture_history: 2 rows returned, zero completed FT rows with full-time score in this read.
- Latest 500 FT live_snapshots: 35 fixtures, all with line/price; payloads contain derived decisions (model_prob, model_ev, edge, reasons), not raw live metrics. No source/received timestamps found in inspected payloads.
- Latest 500 FT entry_decisions: 8 fixtures, all with line/price; these are decision records, not independent training matches.
- First 100 fe_notify_live_state rows: deletion tombstones only. This unordered bounded sample DOES NOT prove that all rows are tombstones or that no active state exists.
- engine_signals and market_snapshots tables absent.
These are bounded observations, not a full database census. Do not claim 500 independent training examples or generalize absence of raw inputs to uninspected storage.

## Model implication
Inspected samples are insufficient for leakage-safe replay of an independent LIVE pricing model. A probability previously stored by the old model is not a ground-truth target or raw model input. Outcome coverage and joins have not yet been audited comprehensively. Forecast accuracy and profitable edge remain unvalidated.

## Required next implementation
1. Separate FT event invalidation from shared HT/HC histories. Reproduce score correction, VAR, red-card change, end-of-half and missing-statistics cases before touching shared v130 code.
2. Track fixture/event/statistics/odds source times separately. A moving match minute must not prove that statistics advanced. Unchanged counters alone also do not prove stale data.
3. Design an append-only, bounded observation record: fixture ID, received_at, source_at when actually provided, phase/minute/score, per-team metrics plus presence flags, event identity, normalized market/line/odds/suspension, source status and model version.
4. Store outcome separately with observed/resolved timestamps. Split evaluation by fixture and chronological time; prevent same-fixture snapshots leaking across training/test sets.
5. Measure API/D1/DO impact before activating collection; reuse existing fetch results. No new provider calls or production collection authorized by this candidate alone.

## Explicit remaining limitations
- This is the first market-only candidate, NOT completion of all FT foundation work.
- Freshness/event corrections are pending; no new probability model, ranking, threshold, frontend or Push policy.
- Missing-line null preservation does not itself implement a new recommendation gate. Existing radar logic can still produce a signal without a priced bet.
- No Wrangler deployment/dry-run gate in this workflow; it is not release certification.
- Do not apply source files from an older alternate build over the exact-production package.
- Before any future deploy recheck active versions, preserve rollback and report concrete scope.
