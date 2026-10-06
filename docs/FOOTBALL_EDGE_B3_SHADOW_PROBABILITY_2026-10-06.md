# FOOTBALL EDGE — BATCH 3 SHADOW PROBABILITY

Date: 2026-10-06  
Production deploy: **NO**  
TOP mutation: **NO**  
Market-edge decision: **NO**

## Purpose
Connect the B2 team/player/lineup/context feature packet to each LIVE candidate without creating new hard gates, then produce a continuous shadow model:

`BASE PROBABILITY -> LIVE UPDATE -> CONFIDENCE`

## Design decisions
1. **No new PASS/FAIL rules.** Missing player/lineup/context data lowers confidence rather than automatically deleting a candidate.
2. **Market is held out of probability.** Current line/price and legacy market score are retained as metadata but are not consumed by B3 probability. This prevents circularity before B4 compares model probability with real market price.
3. **Current FT/H1 components become continuous evidence.** GAME/PRESS/CHANCE/MOM are normalized and combined continuously. GAP/Radar/QSIG remain available evidence; they are not turned into additional gates here.
4. **Team context creates the baseline.** API team attack/defence averages create an expected-goal-rate baseline. If unavailable, a configurable neutral fallback is used and confidence is penalized.
5. **Personnel context affects direction, not eligibility.** Lineup strength, star availability, injury-core share, recent/season/venue PPG, rest and live player rating are small directional evidence inputs. None can make the fixture FAIL.
6. **DQ is confidence, not football truth.** DQ/freshness/data completeness affect confidence; they do not directly inflate prediction probability.
7. **Compact validation journal.** Only material probability/confidence/score changes need to be recorded. Outcomes settle at +5/+10/+15 minutes. No new D1 schema is required for this batch.

## B2 correctness fix found during B3
The B2 helper `finite(v)` treated `null` as numeric zero because `Number(null) === 0`. That could falsely interpret missing provider quota headers or missing context fields as real zero values.

B3 fixes this in:
- `prediction_v2/api-budget-manager.js`
- `prediction_v2/context-feature-layer.js`
- `worker_notify_v138_provider_quota75k.js`

Missing values now stay `null`.

## New files
- `prediction_v2/live-feature-adapter.js`
- `prediction_v2/probability-engine.js`
- `prediction_v2/shadow-evidence.js`
- `prediction_v2/shadow-live-bridge.js`
- `prediction_v2/test-b3.mjs`

## Runtime output
Each LIVE item can receive `item.predictionV2Shadow` with:
- baseline expected goal rate and source;
- LIVE hazard multiplier;
- P(goal next 5m / 10m / 15m);
- home/away next-goal share conditional on a goal;
- confidence 0–100;
- no market edge and no entry decision.

## Important limitation
B3 probabilities are **provisional shadow probabilities**, not yet validated betting probabilities. Coefficients are deliberately bounded and must be calibrated against the evidence journal before they can become decision-grade.

## B4 handoff
B4 may compare the **real line/price that actually exists** with B3 probability to calculate fair price / edge and rank TOP1/TOP2/TOP3.

B4 must not wait for an ideal line that the market does not offer.
