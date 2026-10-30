# FT event candidate — 21 October 2026

Candidate only, not deployed. Extends PR #16's exact production-package reconstruction.

## Changes
- Read the existing LIVE catalog once and invalidate known FT decisions before detail statistics and before batch selection. Score changes including VAR/reallocation and observed phase transitions clear FT history and FT probability output.
- Process red-count changes when both teams have explicit numeric Red Cards statistics. Missing red values remain unknown, not zero.
- FT-specific reset/cooldown is separate from shared HC cooldown and H1 history. The existing five-minute FT cooldown is retained.
- Publish FT cooldown/reset through the existing UI runtime adapter.
- Record statistics receipt time immediately after the successful API read and a separate metric-change time; provider source time remains null when unavailable. Unchanged metrics alone do not mean stale data.
- Repeat event observations do not extend cooldown. Persisted event identity survives restart.

## Validation
26 prior market checks; 16 FT event/clock unit checks; 6 Worker/UI integration checks using candidate Worker source and real FT engine. Missing-statistics baseline defect reproduced. Integration covers goal, VAR, score reallocation, catalog-reported terminal phase, statistics-reported red card, and FT/HC cooldown separation.
All 40 baseline file hashes verified. Candidate changes three existing files (notify-core.js, worker_notify_v130.js, notify-ui-state.mjs) and adds ft-events.mjs. Other baseline files, including v138 scan-status recovery, remain identical.
No production calls needed for these tests. Existing read-only inventory is not repeated.

## Important limits
- LIVE catalog may omit ended fixtures. This patch invalidates a phase transition when observed; absence from catalog alone is not a verified end-of-match result.
- Red-card detection still depends on explicit statistics in this patch; events-only red-card inference when statistics fail is not implemented.
- Receipt/change clocks do not prove provider freshness. Existing freshness/scoring policies are unchanged; no new stale threshold is introduced.
- The observation module does not provide an append-only training history or certified model inputs.
- Known catalog events cause an additional immediate putNotifyMatch for that fixture, and a selected fixture may be saved again later in the cycle. New metadata also increases payload size. No claim of zero additional production writes if this is eventually deployed.
- Shared pre-existing HT/HC behavior is not rewritten. FT event updates explicitly preserve H1/HC histories, alerts and shared cooldown; unrelated legacy behavior is not certified.
- No new pricing model, thresholds, ranking, scanner controls, frontend assets or Push transport.
- Candidate workflow is not a release gate; production/end-to-end phone delivery untested.
