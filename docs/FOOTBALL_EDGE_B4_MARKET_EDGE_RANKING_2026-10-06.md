# FOOTBALL EDGE — BATCH 4 MARKET EDGE + RANKING

Date: 2026-10-06  
Production deploy: **NO**  
Current TOP mutation: **NO**  
Auto-entry/stake: **NO**

## Purpose
Turn B3 probability into a market-aware shadow comparison using only lines/prices that actually exist now:

`MODEL DISTRIBUTION -> REAL MARKET OFFER -> FAIR PRICE / EXPECTED RETURN -> RANKING`

## Core principles
1. **Never wait for an imaginary ideal line.** If the market has -1.25, O2.25, O0.5, etc., the model evaluates that exact offer.
2. **No market offer = no invented alternative.** The fixture can remain visible, but no market edge is fabricated.
3. **Asian settlement is modeled correctly.** Whole, half and quarter lines support WIN / HALF_WIN / PUSH / HALF_LOSS / LOSS.
4. **Market odds are compared after prediction.** B3 holds market out of the probability layer to avoid circular reasoning.
5. **TOP is relative ranking, not forced entry.** If every real offer has negative expected return, TOP1 still means “best currently available” but status remains NO_EDGE.
6. **Confidence is a continuous modifier, not a hard gate.** Low confidence reduces ranking strength rather than deleting the fixture.

## New files
- `prediction_v2/market-edge.js`
- `prediction_v2/market-adapter.js`
- `prediction_v2/opportunity-ranking.js`
- `prediction_v2/test-b4.mjs`

## Supported shadow markets
- Asian Total / Over-Under, including quarter lines.
- Asian Handicap, including quarter lines.

## Model-to-market math
B4 converts the B3 effective goal rate into remaining-match Poisson distributions.

For totals:
- current total goals + future-goal distribution;
- exact Asian Total settlement at the offered line;
- fair odds and expected return at the offered price.

For handicap:
- remaining home/away goal rates;
- joint future score distribution;
- exact Asian Handicap settlement;
- fair odds and expected return.

## Ranking output
Every assessed opportunity can expose:
- real market / selection / line / price;
- fair price;
- expected return / edge percentage;
- confidence;
- rank and TOP1/TOP2/TOP3 position;
- `POSITIVE_EDGE`, `FAIR`, `NO_EDGE`, or `NO_SUPPORTED_MARKET`.

No field in B4 automatically places a bet.

## B5 handoff
B5 must validate calibration and ranking quality using settled evidence: reliability by probability bucket, Brier/log loss, hit rate, opportunity rate, expected-vs-realized return, league/minute/market strata, and comparison against OLD TOP.
