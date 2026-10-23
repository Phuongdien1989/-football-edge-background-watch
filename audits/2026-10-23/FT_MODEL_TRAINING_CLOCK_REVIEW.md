# FT model training-clock validation

Reviewed branch head e4762ebbea829f1466b231e05e879a4da117892a, not the stale PR description or the earlier D1 checkpoint. The earlier isolated D1 run 39699252168 passed eight synthetic checks; it is not live prediction acceptance.

## Reproduced defect and fix

`predictFTTotalExperimental` accepted missing, null, NaN, invalid-string and zero `trained_until` values and returned `OFFLINE_UNCALIBRATED_PMF`. JavaScript comparisons with undefined/NaN did not reject the forecast. Thus an incomplete model export could bypass the temporal guard.

The prediction entrypoint now requires a positive safe-integer training cutoff before comparing decision time. Training, coefficients, feature transforms, probability distribution, model ranking and recommendation thresholds are unchanged. Existing exact-cutoff rejection is preserved; cutoff plus one millisecond remains accepted for otherwise valid offline inputs.

Local model suite: 24 scenarios PASS with 40 synthetic fixtures. New regression covers missing, null, NaN, Infinity, zero, negative, fractional, invalid/numeric strings and unsafe-integer cutoffs. This checks software behavior only; no real forecasting accuracy, market edge or calibration is certified.

## Current remaining model limits

The model is a provisional remaining-goals Poisson baseline with a fixed 94-minute exposure assumption, current goals and shots on target. It does not yet establish reliable effects for opponents, red cards, live pressure trajectories or actual stoppage time. The chronological holdout and hash verification do not authenticate the origin of exported data. All pricing/release eligibility remains blocked. Current tests use synthetic fixtures.

Production version checks must come from the newly requested read-only workflow result; older October 22 values are not evidence of today's deployment. No Worker deployment, scanner action or production D1 query is included in this change.
