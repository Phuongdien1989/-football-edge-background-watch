# Football Edge HT — integrated research candidate (21/10/2026)

This is an integrated candidate, not a production deployment or proof of predictive performance.

## What is connected

- Manual HT ON/OFF, early-half statistics collection, shared HUB/server cache and source timestamps.
- Shared Mobile/backend temporal corrections: true window coverage, gaps, disjoint acceleration comparison and DQ=0.
- HT-only research prediction from actual historical half-time scores, current score and elapsed time.
- Exact first-half integer/half/quarter-line settlement, fair odds and estimated value.
- HT list badges/detail card, sample size, probability chart and visible model limitations.
- Backend candidate publishes research valuation alongside its existing snapshot. FT/HC, old HT thresholds, Master TOP and Push gates remain unchanged.

The predictor is a transparent Gamma–Poisson team-rate research baseline: Jeffreys prior alpha=1/2; each unique historical HT is one exposure; observed current-half goals and elapsed-half exposure update the rate. It uses up to eight known results per team, deduplicates shared fixtures, excludes the target/future results and reports actual n. It does not convert a pressure score or a FT rate to HT probability.

## Real-data finding and bounded warm-up

Read-only production validation found only 2 fixture-history rows and zero usable FT half-time scores. A schema alone did not establish usable model data.

The candidate therefore does not depend on that empty history being magically populated:

1. Read the latest at most 500 D1 fixture rows, cached one hour; this is read-only.
2. When a selected HT fixture lacks usable team samples, request at most TWO team-history responses per existing scan cycle.
3. Mobile uses the existing footballCached wrapper. Backend uses the existing notify API wrapper, so these requests count toward the existing daily/global provider quota and pacing.
4. Reuse team cache for one hour; concurrent requests for the same team deduplicate. Failures back off for one minute. Missing half-time scores are never filled from FT scores.
5. Do not add a timer, alter the scan cadence, increase the API budget, upgrade the plan or write history rows to D1. Cached context requires zero extra team-history calls.
6. After context arrives, require a source observation at or after that receipt time; do not leak future context into older snapshots.

The limit is two additional team-history calls per cycle, not zero additional traffic. It is not a claim that all account traffic fits Free. Existing quota guards still apply. After restart, memory-cache loss may cause re-fetching, counted by those guards.

## Model limits visible on the card

- Research, unvalidated; no claim of improved hit rate, profit or calibrated probability.
- Constant HT rate, no opponent-strength/shot-intensity/red-card adjustment.
- Nominal 45-minute clock; added time is not estimated. No new model at minute0 or nominal45.
- Small samples are shown honestly; absent samples keep MODEL WAIT.
- Sensitivity scenarios are not advertised as calibrated confidence intervals.
- Early research recommendations do not silently change Push policy. Existing Push remains inherited.

## Build and test

From repository root:

    node ht-early-candidate/build.mjs
    node ht-early-candidate/test.mjs
    node ht-early-candidate/test-collection.mjs
    node ht-early-candidate/test-valuation.mjs
    node ht-early-candidate/test-model.mjs
    node ht-early-candidate/test-history.mjs

Generated scoped patches reconstruct the pinned baseline exactly after reversal. Root production files are not edited. The package overlays only HT scanner/evaluator and added modules on backend production source da5242bb41b2401271f52dda17b0e2208e7e3819, and preserves current Mobile static assets before overlay.

CI also verifies the complete backend import chain by Wrangler dry-run, runs Chromium/WebKit at 390px/1280px and packages frontend/backend source, original assets/source backup, hashes and evidence. The ZIP is not a database backup.

## Demo and release boundary

https://football-edge-ht-candidate.ngophuonghuy.workers.dev/

This separately tagged zero-binding preview contains fictional DEMO fixtures. It cannot scan, call the provider/D1 or send Push. It is for visual review.

Production Mobile/backend/Desktop remain unchanged. Real iPhone/PWA behavior, account-wide quota measurement, LIVE/PUSH delivery with this candidate and forecast performance need authenticated staging acceptance before a main-app release. Do not deploy the generated scanner alone or infer that a green build proves football prediction accuracy.

Preserved production checkpoints at the last verification:

- Mobile: 3c0e47ed-275b-410c-b527-77f1ff65a28a
- Backend: 04cc044d-412f-4844-9b83-c7c786eedd13
- Desktop: a332ee39-abb2-422d-a021-db78ef19cc10

Local execution was unavailable. GitHub Actions is the build/test environment; no production credentials are embedded in the archive.
