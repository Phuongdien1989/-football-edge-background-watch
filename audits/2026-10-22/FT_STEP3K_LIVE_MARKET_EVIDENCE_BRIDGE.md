# Football Edge — FT AI V2 Step 3K: binary Goal Radar vs bookmaker O/U provenance bridge

Date: 2026-10-22 (Asia/Ho_Chi_Minh). Branch: `fix/ft-foundation-20261021`, PR #16 Draft; NO merge, NO production deploy, NO D1/schema modifications, NO scanner/Push/TOP changes.

## Critical verified finding from actual existing backend code
- `notify-core.js` `watchEvaluate` outputs an FT **score** with quality/gates/market sentiment, not a full regulation goal-total probability distribution.
- `notify-core.js` `grEstimate(ft, 'FT')` estimates a binary **`goal_ft`** event using goal-radar calibration; `n=0/source=MODEL` can represent a fallback estimate. This event probability is **not** the PMF of the *final total regulation match goals*.
- `worker_notify_v130.js` produces normalized `compact` live market rows, `ft.eval`, and per-device `goalEstimates`. Staged `patch-recorder.mjs` freezes the same data into paired `FT_OBSERVATION_V1_DRAFT` + `FT_DECISION_V1_DRAFT`; the paired row includes raw odds receipt and normalized market data.
- Thus deriving `P(Over 2.5)`, fair odds, market-edge or ROI from score `78/100` or from a `goal_ft=71%` binary probability would be a false equivalence. The new code explicitly refuses it.

## Implemented on branch, offline only
- `ft-audit-fix/ft-pricing-evidence-bridge.mjs`: `extractFTPricingEvidence({observation,decision})` consumes an *already frozen pair*, verifying fixture identity, 2H state, receipt chronology, no future score leakage (including source.fixture), unblocked full-match `over_under` market identity, available Over/Under legs at same quarter-goal line and active odds.
- Newly added **raw parity**: both normalized prices/line and bet ID must match the corresponding original `sources.odds.data` API response for exactly the same fixture. Any mismatch, missing bet ID, suspended market, first/second-half, team totals, multi-bookmaker ambiguity, stale or bad source timestamps fails closed. Provider source timestamp null is marked unknown; late receipt >5min is a warning, not an invented quote or a new ranking veto.
- A matching quote is marked `EVIDENCE_READY_UNPRICED`, with receipt time and original normalized data; **bookmaker identity and live settlement convention are not independently captured/verified** by legacy normalizer, hence quote.executable=false. No forced market agreement.
- Signal family is `GOAL_RADAR_FT_BINARY_EVENT_NOT_FULL_TOTAL_DISTRIBUTION`. `goal_ft` per-device sample size, score, source remain separate evidence and NEVER become fair odds.
- No missing probability distribution is silently filled; `pricing.status='UNPRICED'`, `fair_decimal_odds=null`, `ev=null`, `final_recommendation=null`. Does NOT call `reviewFTTotalPrice` without a genuinely modeled distribution.
- `ft-audit-fix/pair-outcome-replay.mjs` now adds a `market_evidence` counts breakdown on valid immutable pair rows: raw-verified O/U quote pairs vs missing or mismatched quotes; pricing, executable and full-final-goals-PMF counts remain zero until separate evidence/models exist.
- `ft-audit-fix/test-ft-pricing-evidence-bridge.mjs`: 32 targeted cases, including price tampering, team/half markets, mixed book fixtures, contradictory main lines, duplicate books, live receipt timestamps, missing PMF, synthetic fallback incorrectly treated as calibration, etc.
- `ft-audit-fix/test-pair-outcome-replay.mjs` adds two end-to-end immutable pair audits proving valid raw matched market yields evidence but not EV, and forged normalized quote is rejected.
- `.github/workflows/ft-audit-foundation.yml` runs this bridge regression within the existing offline FT suite.

## Independent CI result
- FINAL [FT candidate suite PASS run 39807440467](https://github.com/Phuongdien1989/-football-edge-background-watch/actions/runs/39807440467), commit `5e38ec38a849ed780e6d80aa2c709d88743086ec`, with `FE_FT_PRICING_EVIDENCE_3K_PASS {tests:32,model_pmf_exists:false,production_deploy:false,D1_writes:0}`.
- `FE_FT_TOTAL_SETTLEMENT_OFFLINE_PASS {checks:28}` persists, with two new paired replay audits PASS.
- Intermediate integration CI failed on **mock data chronology**: mock odds `received_at=n-2900` was later than observation `decision_at=n-3000`, correctly rejected by guards. Fix commit changed mock odds received_at to `n-3500` and final CI passed. The anti-future-leakage rule was NOT weakened.

## Explicit release hold / next work
1. This is not a production FT V2 release: PR #16 remains Draft and production uses pre-existing FT engine; Mobile Outbox has been independently released only.
2. No real goal-total distribution from a separately versioned model or calibrated replay dataset has been validated. Fair odds, EV, hit rate and profit edge are **NOT established**, and cannot be inferred from binary Goal Radar probability.
3. To move from market-evidence bridge to real AI pricing, define/train and backtest a final-regulation-goal-total PMF using pre-decision data only (no future leakage); freeze model version, model receipt time, missing-data handling; evaluate calibration/coverage in chronological holdout against real outcomes.
4. Confirm live bookmaker identity and whether displayed FT totals settle on full match regulation (not remaining goals) before returning executable recommendations. Do not assume provider odds line conventions.
5. Read-only new UTC-day D1 quota check after 2026-10-23 00:00 UTC (07:00 Vietnam), validate client ACK and real indexed D1 write cost before any bounded manual scan; scanner remains OFF at last production verification.

**Conclusion:** FT live-market linkage and replay-based evidence accounting **offline PASS**; actual model-versus-bookmaker price agreement **BLOCKED BY MISSING REAL GOAL-TOTAL PMF + UNVERIFIED BOOKMAKER SETTLEMENT + D1 LIVE TRIAL**. No production or scanner changed.
