# FOOTBALL EDGE — BATCH 5 VALIDATION / OLD-vs-NEW

Date: 2026-10-06  
Production deploy: **NO**  
Model promotion: **NO**

## Purpose
B5 prevents Prediction V2 from becoming another attractive-looking but unproven scoring system.

The system must now prove, with settled observations captured at the decision time, whether:
- predicted probabilities are calibrated;
- new ranking expands usable opportunity coverage without destroying accuracy;
- positive model edge becomes positive realized paper return;
- player/lineup/context features add predictive lift;
- results remain stable across league, minute, confidence and market strata.

## New validation modules
### `prediction_v2/validation-metrics.js`
Computes:
- Brier score;
- log loss;
- mean predicted probability vs observed outcome rate;
- Expected Calibration Error (ECE);
- probability reliability buckets;
- minute/confidence/league/market strata;
- opportunity rate and hit rate;
- expected-vs-realized paper market return.

Only settled observations are included.

### `prediction_v2/old-vs-new-comparator.js`
Runs paired comparison on the same fixture/time observation:
- OLD TOP eligible or not;
- NEW ranked TOP1/2/3 or not;
- NEW positive-edge status;
- coverage/opportunity rate;
- hit rate;
- old-only and new-only disagreement outcomes.

This allows us to answer the key question:
> Did V2 actually improve useful coverage/accuracy, or did it only create more recommendations?

### `prediction_v2/paper-market-evidence.js`
Freezes the exact real offer used at observation time:
- market;
- selection;
- line;
- odds;
- bookmaker;
- fair odds;
- expected return;
- model confidence.

After FT it settles the same frozen offer using correct Asian Total / Asian Handicap settlement and records realized unit return.

No future line or later odds may replace the captured offer.

## Validation gates for model promotion
B5 intentionally does **not** hard-code a betting threshold such as “edge > X% = enter”.

Instead, model promotion requires evidence that:
1. calibration is acceptable across probability buckets;
2. Brier/log loss do not regress materially;
3. increased opportunity coverage is not bought by large hit-rate degradation;
4. positive-edge buckets show realized lift over adequate sample;
5. performance is not concentrated in one small league/minute stratum;
6. OLD-vs-NEW disagreement cases support the new model rather than merely increasing volume.

Exact promotion tolerances are to be frozen only after we inspect real sample distribution. They must not be invented in advance.

## Anti-leakage requirements
- prediction snapshot timestamp must precede outcome window;
- player/lineup/context data must be what was available at capture time;
- market line/price is frozen at capture time;
- later events cannot rewrite the feature packet;
- settlement can only populate outcome fields.

## What B5 does NOT do
- no production deployment;
- no current TOP replacement;
- no automatic bet/entry;
- no stake sizing;
- no D1 schema migration;
- no hidden future-data backfill into prediction snapshots.

## Next operational phase
Run OLD TOP and Prediction V2 in parallel shadow mode on the same LIVE universe, capture compact evidence, and accumulate real samples.

Review checkpoints:
- first diagnostic: 500 settled observations;
- meaningful comparison: 1,000+;
- stronger stratified validation: 3,000+.

These are review sample checkpoints, not promises of statistical sufficiency for every league/market stratum.
