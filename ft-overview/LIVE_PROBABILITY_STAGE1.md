# FT V2 — LIVE Probability Engine stage 1 (24/10/2026)

Implements replay-safe `liveEvidence` and `liveProbability` in `ft-overview/live-probability.mjs`.

- Observes changes in total shots, shots on target, in-box efforts and xG over at most ten minutes, and ONLY when score is unchanged. Discards future timestamps, stats counter resets, absent observations and old windows.
- Keeps the independent historical Poisson distribution unchanged. No market odds, Goal Radar score or arbitrary intensity multiplier is used to fabricate a LIVE probability. Exposes status `BASELINE_WITH_LIVE_EVIDENCE`, `liveAdjusted: false`, and `additionalProbability: null`.
- This is **LIVE evidence instrumentation**, NOT an outcome-calibrated LIVE probability model. Numerical adjustments remain unimplemented until matched historical snapshots with final outcomes allow out-of-sample evaluation.
- The existing FT Overview trial decision can still read the uncalibrated baseline; any such selection MUST be labeled Experimental.
- No additional API calls, D1 writes, scanner/push controls, production changes, or Gate B/C action.
- Test: `node ft-overview/test-live-probability.mjs`. Next: read-only replay cohort, fit/evaluate time and game-state conditional response with leakage-safe train/test split; only adopt adjustments if they beat baseline calibration and log-loss.
