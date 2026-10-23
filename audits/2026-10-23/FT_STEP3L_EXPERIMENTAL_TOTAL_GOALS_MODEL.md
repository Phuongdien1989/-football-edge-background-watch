# Football Edge — FT AI V2 Step 3L: Goal-total probability model foundation (2026-10-23)

## Status (do NOT mistake implementation for predictive validation)
- Draft PR #16 branch `fix/ft-foundation-20261021`; backend production, mobile, HT, HC, TOP, Push, scanner and D1 schema **unchanged**.
- New module `ft-audit-fix/ft-total-cohort.mjs` forms a one-fixture-per-row training cohort from cryptographically reverified immutable Observation+Decision PAIR and separately linked regulation FT Outcome; latest contradictory revisions and canceled fixtures excluded. Final score always used ONLY as a later training label.
- Live second-half prediction inputs: minute, already-scored goals, and total shots on target (ONLY if both predecision team statistics are present; strict integer or numeric-string, missing remains null).
- New `ft-audit-fix/ft-total-experimental-model.mjs`: independent **remaining-goals Poisson** baseline with provisional effective match duration assumption (94 minutes, UNVALIDATED). Produces a mathematical PMF of final full-regulation goal totals by adding already-scored goals exactly once; outputs explicit `OFFLINE_UNCALIBRATED_PMF` and `pricing_eligible=false`.
- No use of bookmaker odds, Goal Radar FT binary probability, HT/HC state, Push history, TOP, or post-decision provider data to train or compute model features.
- Training and holdout are separated by **fixture and actual time**. First held-out decision at T; a training row enters the model only if its final outcome was *available before T*, preventing information leakage from games completed after T. Model version is hashed from the exact training fixture+feature/label/clock cohort. A model cannot forecast retrospectively before `trained_until`.
- Validation emits out-of-time Poisson negative log-likelihood, Brier score at Over 2.5, observed/predicted rates, and improvement vs an intercept-only Poisson baseline. These are error *measurements*, not validated profit claims.
- Source-hash verification `ft-audit-fix/ft-total-outcome-export.mjs` recomputes canonical hashes and record IDs for imported D1 Outcome ledger rows; discrepancies quarantined before training.
- Explicit offline-only runner `ft-audit-fix/ft-total-offline-replay.mjs` accepts locally supplied JSON with `pair_rows` + `outcome_ledger_rows`; no Cloudflare API, D1 queries/writes, deployments or sports provider calls. It records `source_attestation=UNVERIFIED_EXTERNAL_EXPORT_ORIGIN` to avoid assuming that a hash proves remote truth.
- This runner and model remain **separate from deployed FT/HT/HC code**; no model fair odds, live EV, bookmaker agreement, calibration, accuracy or ROI has been certified.

## Verified CI
- [FT entire candidate and model suite PASS](https://github.com/Phuongdien1989/-football-edge-background-watch/actions/runs/39881197424); new Step 3L tests **23/23 PASS** (40 explicitly SYNTHETIC fixtures, 0 real production training labels).
- Tests cover hash-verified pairs and outcome exports, missing outcome not a loss, live score > final score corrections, conflicting result revisions, source-level future-label leakage, numeric-string statistics, unique fixtures, chronological purging, stable model version, no odds contamination, Brier/logloss finite, probability distribution summing to one, and model prediction time restrictions.
- Earlier 3J mathematical Asian total settlement 28/28, 3K market provenance 32/32 and HT/HC isolation tests remain part of same offline CI PASS.
- No real D1 writing, scanner startup, pricing release, user-facing card change, or production backend deploy.

## Honest next gates
1. Acquire a **real pre-decision FT cohort** with matching immutable pair and later verified regulation outcomes (distinct fixtures, audited receipt clocks). Real D1 pair-outcome remote write acceptance was blocked on Oct22 Free daily rows-written quota. Use fresh-day read-only quota and actual live capture approval; do not confuse synthetic tests with observations.
2. Evaluate accuracy on genuinely out-of-time real data and calibrate by match minute, remaining goals, market line, missing stats, and coverage. Compare model to simple historic/market-independent baseline, and avoid asserting a 1% edge without uncertainty bounds.
3. Verify bookmaker ID, exact FT market scope, pricing timestamps, and live settlement rules. Mathematical fair-odds function exists, but experiment PMF has `pricing_eligible=false` and is NOT allowed to create FINAL recommendations.
4. Benchmark Cloudflare account-wide billed D1 rows, provider quota, HT/HC/Push unchanged, mobile IndexedDB ACK and rollback before enabling any FT trial.
5. After user approval for major deployment, release in constrained flag mode; no autorun scanner until explicitly approved.

**Assessment:** FT model scaffolding is now present; **model validity, calibration, live data completeness, D1 budget and production integration remain unverified**. Do not alter previous overall percent-complete estimate solely because source code was added.
