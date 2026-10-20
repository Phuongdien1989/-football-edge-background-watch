# Football Edge — HT Candidate, 21/10/2026

This checkpoint supersedes the earlier stage1–3 notes bundled with intermediate artifacts.

## Completed

- Early HT collector starts only with manual ON and uses shared source observations. Cached responses do not acquire a new source timestamp. Quiet fixtures are revisited.
- A shared temporal helper fixes short-window maturity, false 100% acceleration, gaps and zero-DQ handling.
- HT research prediction uses actual half-time scores from the existing fixture_history table. It takes up to eight known results per team, deduplicates shared fixtures and excludes target/future results. It reports actual sample size.
- The explicit baseline is a Gamma–Poisson HT goal-rate model with Jeffreys prior and current elapsed-half exposure. It is independent of market odds and legacy pressure scores. It is NOT a calibrated live-intensity model.
- Read-only HT context is limited to the latest 500 fixture rows, cached one hour. Failed context reads retry at most once per minute. No model-context writes or new API-Football requests are added.
- Contract pricing handles first-half integer/half/quarter totals, current score, exact quote and source time. No FT-to-HT scaling, forced five bets or guessed zero inputs.
- Backend candidate publishes the same research valuation in its existing snapshot. Mobile candidate displays research pricing inside HT list/detail views. Existing Master TOP, FT/HC scoring, old HT thresholds and Push decisions remain unchanged.
- A complete frontend/backend source overlay and pre-change asset/source backup are packaged. Source backend baseline is da5242bb41b2401271f52dda17b0e2208e7e3819; only the scoped HT evaluator/scanner and added modules are overlaid.
- No production release has occurred.

## Verification

Code commit: ab079024c29a3a02f48d8c84a992b4b85667c9ad

PASS workflow: https://github.com/Phuongdien1989/-football-edge-background-watch/actions/runs/39489155884

- 72 unit/runtime/replay tests PASS: 14 temporal, 21 collector/HUB, 25 settlement/provenance, 12 HT model/context.
- Backend Wrangler dry-run PASS: 558.87 KiB, gzip 123.69 KiB.
- Chromium and WebKit PASS at 390px and 1280px.
- Original five tabs preserved, no horizontal overflow, five distinct demo fixtures.
- Browser harness sent zero external requests.
- Baseline asset hashes verified before packaging.
- Real iPhone/Safari PWA, live Push delivery and prediction accuracy are NOT certified by these checks.

## Review preview

https://football-edge-ht-candidate.ngophuonghuy.workers.dev/

Preview version: bfad4ed5-355a-4dd8-9d46-bd5257e1a61e

This is a clearly labelled fictional DEMO. It has zero bindings, no API/D1 access, no scan and no Push. Do not use its fictional prices as live betting recommendations.

## Production preserved

Verified equal before and after preview publication:

- Mobile shiny-silence-d892: 3c0e47ed-275b-410c-b527-77f1ff65a28a
- Backend football-edge-background-watch: 04cc044d-412f-4844-9b83-c7c786eedd13
- Desktop football-edge-desktop-b2-test: a332ee39-abb2-422d-a021-db78ef19cc10

The archive contains source/assets and evidence, not a database export. Existing production versions and their rollback remain untouched; rollback was not exercised during this checkpoint.

## Important limits and release boundary

The rate model assumes a constant HT scoring rate and nominal 45-minute clock. It does not adjust the forecast for opponent strength, live shot intensity or red cards, and does not estimate added time. Those limitations remain visible on the card. Missing true HT samples cause MODEL WAIT. New early-HT research pricing does not silently enable early Push.

Before main-app release: review the actual phone layout, verify authenticated staging context reads/model samples and source synchronization, measure account-wide D1 usage and live Push on staging, then authorize a pinned Mobile/backend rollout with rollback. Do not change the scan cadence, API budget, frontend/FT/HC logic or paid plan to hide a failure.
