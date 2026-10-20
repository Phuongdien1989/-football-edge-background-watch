# FT OVERVIEW — candidate checkpoint, 19 October 2026
Owner-approved isolated implementation; production acceptance pending.

## Delivered candidate
- PR: https://github.com/Phuongdien1989/-football-edge-background-watch/pull/12 (DRAFT)
- Branch: feature/ft-overview-shadow-20261019
- Tested source: 3b7b3c497aa5cb0bd842cd01eb199e64b6e7a652
- Workflow PASS: https://github.com/Phuongdien1989/-football-edge-background-watch/actions/runs/39241039402
- Demo: https://football-edge-ft-overview-preview.ngophuonghuy.workers.dev/
- Preview version: 4aaf25b7-19ab-4095-9042-c5a955f0ce5e
- Freeze: 41f55ce1a192ca7b457a84b70c9ea9ec1b274967
- Philosophy: design/DUAL_VALUATION_FT_PHILOSOPHY_20261019.md

## Verified implementation
20 deterministic cases PASS, including quarter/whole/half total settlement,
current goals counted once, EV versus market agreement, dedup/retry, revision
conflicts, stale expiration, score-aware price invalidation and restart replay.
Original Mobile source fetched read-only, SHA256 verified and exact baseline
reconstruction PASS after removing additive injections. HT/FT provider and UI
regressions PASS. Browser QA PASS at 390 and 1280px, original three cards and
read bridges present, no new external requests from addon, no overflow.
Public HTTPS demo smoke PASS, zero page errors and zero external requests.
Negative-EV demo explicitly waits for price despite model above no-vig market.

The addon only reads existing snapshots, with a bounded session-scoped checkpoint.
No new fetches, D1 writes, engine setters or Push. No production deployment.
The preview Worker has zero bindings and connect-src none.

## Exact remaining work — not claimed complete
- Calibrated independent PRE/LIVE goal distribution, uncertainty and event response.
  Current recent-history Poisson/time-only baseline is explicitly RESEARCH.
- Market inversion for nonbinary quarter/whole lines. Settlement arithmetic works;
  no-vig event probabilities are deliberately unavailable for those lines.
- Validated opportunity-ranking mechanism. Current TOP is stable attention order
  based on completeness, not a proven investment ranking.
- Evidence-grounded reconciliation beyond transparent observed differences.
  No claim to infer bookmaker intention or hidden information.
- Actual input coverage/line-rule verification on real shared snapshots.
- End-to-end outcomes, production LIVE/PUSH and combined notification acceptance.
- Upstream statistics rate-limit problem remains; this change does not repair it.

The public URL is fictional DEMO only. The integrated original-app candidate is
included in the workflow artifact, not deployed over the user's Mobile application.
Live recommendation action remains NO_LIVE_RECOMMENDATION.

## Production version verification before and after preview
- football-edge-background-watch: 04cc044d-412f-4844-9b83-c7c786eedd13
- shiny-silence-d892: 03c1d55d-358a-448b-96f3-f356704831df
- football-edge-desktop-b2-test: a332ee39-abb2-422d-a021-db78ef19cc10
Versions match before/after exactly. Existing rollback references untouched;
no new claim of rollback execution or data backup.

## Source-check findings retained for later tests
Current old HT Push thresholds its score; FT Push thresholds grEstimate probability.
Legacy score includes market and cannot be reused as independent probability.
Missing-half FT context scoring can add points from zero-filled aggregates; confirmed
on actual unchanged core (context=9, DATA_INCOMPLETE, hardVeto=true in a zero-stats
case). No old-engine scoring patch was included in this feature candidate.
