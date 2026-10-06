# FOOTBALL EDGE — BATCH 1 AUDIT

**Date:** 2026-10-06  
**Scope:** exact deployed frontend P2.0.5.2 + frozen source baseline + production deployment evidence  
**Production change:** NONE  
**Goal:** identify why TOP is too rare, map API data already available, and define the safe conversion from hard-rule ranking to data-driven prediction/ranking.

## 0. Baseline lock
- Production frontend service: `shiny-silence-d892`
- Exact deployed P2.0.5.2 frontend SHA256: `a82bf87e1db875fb975b94ac9b6df9e785818de37b7bb55fec6f290efca9c844`
- Frozen frontend baseline SHA256 before P2.0.5.2: `f2d5c471c247ed77b07e3cb9096e5c04ae9c69b4d8af1b25a4fbe7ca955bfb5c`
- Actual GitHub deployment commit: `58705584cf777766f28e50ac937d2972000e302f`
- Freeze branch: `freeze/frontend-p2052-production-before-prediction-v2-20261006`
- Working branch: `work/prediction-v2-audit-20261006`
- Production has NOT been changed.

## 1. Main finding — current TOP is structurally too restrictive
Current TOP ranking is explicitly `PRESENTATION ONLY`, not a probability/edge model.

Current rank order is lexicographic:
`STATE → DQ → FRESHNESS → EVIDENCE → MARKET → CALIBRATION → CONFLUENCE`

There is no combined predictive probability and no market-edge objective in TOP selection.

### Eligibility bottleneck
For Goal engines: STRONG=4, READY=3, CANDIDATE=2, WATCH=1.
For Handicap: *_STRONG=4, *_LEAN=2, *_BIAS=1.

Current TOP eligibility requires:
`primary.stateRank >= 3 && !hardConflict && !adaptiveGuard`

Therefore Goal CANDIDATE/WATCH and HC LEAN/BIAS can never enter TOP. Only Goal READY/STRONG and HC STRONG are eligible. This directly explains why a LIVE session can show useful candidates but no TOP.

## 2. FT Goal engine
Active thresholds: WATCH 55, CANDIDATE 65, READY 73, STRONG 80.

Score components: GAME 15, PRESSURE 20, CHANCE 20, MOMENTUM 15, MARKET 15, CONTEXT 10, DQ 5.

CORE uses PRESS / CHANCE / MOM and STRONG also requires mature momentum and market availability. Partial statistics are capped at 68, so partial-data matches cannot become READY/STRONG and thus cannot enter current TOP.

## 3. H1 Goal engine
Active thresholds: WATCH 54, CANDIDATE 64, READY 72, STRONG 79.

Partial statistics are also capped at 68, which prevents READY/STRONG and therefore TOP eligibility.

## 4. Handicap engine
HC STRONG requires multiple simultaneous conditions including meaningful live gap, CORE pass, strong evidence, market availability and market agreement. HC LEAN receives state rank 2 and cannot enter current TOP.

## 5. API data already available
Production already fetches/can fetch:
- fixtures and LIVE fixture snapshot
- fixture statistics including half statistics
- events
- lineups
- fixture/player statistics
- injuries
- pre-match odds and live odds
- H2H
- recent fixtures
- standings
- team statistics
- API predictions

Production also derives player top ratings, substitutions and red-card context. But player quality/form, star impact, lineup strength, injury importance, rotation/workload and personnel matchup are not yet calibrated predictive features in the main FT/H1 TOP decision.

## 6. Acquisition foundation to preserve
Existing ULTRA hub already uses adaptive polling tiers HOT / ACTIVE / BACKGROUND, plus in-flight dedupe, TTL reuse, freshness tracking and IndexedDB persistence. Extend this layer rather than replacing it.

## 7. UI finding
P2.0.5.2 already contains the intended behavior: H1/FT detail cards are hidden by default while engines continue feeding Goal Radar, Master Opportunity, TOP Ranking, Smart Follow and Validation. Preserve the compact executive Candidate/Master card as the primary surface.

## 8. Prediction V2 change map

### KEEP AS HARD SAFETY / INTEGRITY GUARDS
Only conditions that make prediction unsafe or invalid: terminal/invalid fixture state, genuinely corrupt market payload, confirmed unusable LIVE data after retry, future-leakage protection, and unsupported market for a market-specific edge calculation.

### CONVERT TO FEATURE / CONFIDENCE INPUT
GAP, Goal Radar, QSIG, DQ/Coverage/Integrity/Freshness, CORE, momentum maturity, partial-data availability, market agreement/divergence, player rating/form, star impact, lineup strength, injuries/suspensions weighted by importance, rest/workload, formation/coach, home/away strength, recent form, live personnel matchup.

### NEW CENTRAL FLOW
`REAL API DATA → FEATURE STATE → BASE PROBABILITY → LIVE UPDATE → CONFIDENCE → AVAILABLE MARKET → FAIR PRICE / EDGE → RANKING`

TOP must rank real available opportunities, not wait for an ideal line that may never exist.

## 9. Target TOP V2 behavior
- Continuously rank the current opportunity universe.
- TOP1 means best current candidate, not automatic entry.
- TOP can be LOW EDGE / NO ENTRY.
- CANDIDATE/WATCH can remain rankable instead of being structurally barred.
- Evaluate actual market lines/prices that exist now.

## 10. B1 does not change production
No production frontend, worker, push, D1 schema, thresholds, TOP logic or API quota behavior was changed in B1.
