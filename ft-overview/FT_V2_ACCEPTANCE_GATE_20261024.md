# FT V2 Experimental — acceptance and release gate (24/10/2026)

## In place on Draft PR #16
- FT Overview market/settlement + independent, *uncalibrated* historical Poisson benchmark.
- Decision Review for Trial Over / Wait Price / Model Wait / Data Wait, with assumptions and ±5 percentage-point stress test.
- LIVE evidence read-only trend: 10-minute as-of deltas, no guessed impact on probability.
- Independent offline join: pilot Observation/Decision + final Outcome + frozen as-of model forecast.
- Brier, Log Loss, exclusion reasons, EV/minute/LIVE descriptive cohorts and offline local JSON Validation Dashboard.
- Cohort parity: invalid calibration rows are excluded from ALL cohort counts.

## Must NOT claim ready
- LIVE-adjusted probability has not been trained or evaluated on real data.
- No verified real pilot forecasts/outcomes analyzed yet; initial dashboard counts may be zero.
- No sample-based EV reliability, investment return, model calibration, production traffic, quota or HT/HC/TOP/Push preservation certified end-to-end.
- Backend FT pilot flag remains OFF, production schema untouched, Gate B/C not authorized.

## Next practical gate
1. Confirm an allowed historical *read-only* source can produce as-of frozen independent PMF **and** verified later final result. Existing FT Pilot observation pairs alone do NOT guarantee this.
2. Export minimal fields with redacted identities and secrets; never generate historical forecast from the final.
3. Run offline cohort dashboard and inspect sample exclusions; require independent future-period holdout to claim calibration.
4. Separately approve an isolated preview/test deployment. Production backend schema/flag changes require Gate B and live capture Gate C, including account-wide D1 quota review.
5. Only after real validation, consider LIVE probability adjustment and out-of-sample comparisons against unchanged Poisson baseline.

## Test
GitHub Actions `ft-v2-experimental-review.yml` runs decision, E2E, cohort calibration-parity, provenance, old Overview regression and UI syntax. This is a code-quality gate, never a forecasting-performance certificate.
