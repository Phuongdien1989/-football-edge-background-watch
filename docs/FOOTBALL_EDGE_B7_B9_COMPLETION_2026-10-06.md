# FOOTBALL EDGE — B7/B8/B9 COMPLETION PACKAGE

Date: 2026-10-06  
Production TOP replacement: **NO**  
Production auto-promotion: **NO**

## B7 — persistent evidence
Prediction V2 staging now records only material snapshots, reconciles +5/+10/+15 goal outcomes, links OLD-vs-NEW paired observations, and settles paper market records when a terminal score is available.

When Background Worker URL/token is configured, the staging app syncs changed records into the **existing** D1 `validation_results` table through the already-deployed `/api/db/sync` contract. No new database, R2 bucket, or schema migration is required.

Three validation types are written:
- `PV2_PREDICTION`
- `PV2_OLD_NEW`
- `PV2_PAPER_MARKET`

IDs are deterministic and writes are upserts. A local content signature prevents re-writing unchanged evidence every minute.

If the Background Worker is not configured on the staging origin, evidence remains in local storage and can still be exported.

## B8 — validation dashboard
The staging Shadow card now has a collapsed **VALIDATION** control. It can combine local evidence with D1 evidence and show:
- settled P10 sample count;
- Brier score;
- ECE;
- mean predicted vs observed rate;
- OLD TOP coverage vs NEW TOP coverage;
- NEW-only disagreement count;
- settled paper samples and realized units;
- positive-edge realized return.

The panel remains hidden until requested so the main UI stays compact.

## B9 — promotion guard
The engineering pipeline is complete through a manual promotion gate:
- <500 settled P10: `COLLECT`
- 500–999: `DIAGNOSTIC_REVIEW`
- 1,000–2,999: `MEANINGFUL_COMPARISON`
- 3,000+: `STRATIFIED_REVIEW`

These are **review checkpoints only**, not automatic proof that V2 is better.

`production_ready` is intentionally always false in code. There is no auto-promotion. A human review must inspect calibration, old-vs-new disagreements, realized edge, and league/minute/market strata before replacing production TOP.

## What is now finished
The complete candidate path exists:

`API DATA -> CONTEXT FEATURES -> LIVE FEATURES -> PROBABILITY -> CONFIDENCE -> REAL MARKET -> FAIR PRICE/EDGE -> RANKING -> EVIDENCE -> SETTLEMENT -> CALIBRATION -> OLD-vs-NEW -> MANUAL PROMOTION GATE`

## What cannot be manufactured in code
Real predictive lift requires future settled LIVE observations. Engineering can automate collection and analysis, but it cannot legitimately fabricate the 500/1,000/3,000 observations or pre-declare V2 superior.

Until evidence proves promotion, production P2.0.5.2 remains the rollback baseline and the current production TOP remains authoritative.
