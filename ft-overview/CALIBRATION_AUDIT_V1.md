# FT V2 offline outcome calibration audit — 24/10/2026

`calibration-audit.mjs` **never fetches** data, changes Cloudflare, or trains on synthetic final scores.
It consumes only explicitly supplied as-of decision rows with later regulation-time verified finals, matched fixture IDs, valid source receipt times and historical PMF.
Output: Brier score, log loss, calibration buckets, sample/exclusion audit and a HARD `model_calibrated:false` flag.
Quarter/integer Asian total lines are excluded from this first binary .5 calibration audit; these require settlement-aware scoring.
Multiple observations of the same fixture are rejected rather than silently inflating sample size.
At fewer than 30 eligible **real** cases status is `INSUFFICIENT_OBSERVED_OUTCOMES`.
Even above 30 it says `MEASURED_UNCALIBRATED` until independent out-of-sample validation is separately approved.
This module does not claim any actual sample exists, and does not authorize LIVE adjustment, bets or deployment.
`node ft-overview/test-calibration-audit.mjs` tests synthetic cases *only for code correctness*, not model accuracy.
