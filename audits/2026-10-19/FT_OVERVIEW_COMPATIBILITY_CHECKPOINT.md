# FT OVERVIEW — app compatibility checkpoint

Candidate source: `d1538e4c42ba8348eab5603df1e1036231eacb25`.
PR #12: `feature/ft-overview-shadow-20261019`.

## Completed in this follow-up

1. Keep up to 50 detached DEEP contexts by fixture in the additive bridge. Reads
   do not invent a new receipt timestamp or discard a prior selected match.
2. Read legacy reset/cooldown controls separately. Reconcile multiple engines
   conservatively without changing their state or recorded football observation.
3. Enrich an observation with newly fetched historical context while preserving
   its original timestamp, score, statistics and price. Reject conflicting or
   older contexts. Replace its chart point rather than duplicate it.
4. Use one local observation-time revision domain across foreground/server
   inputs; a small server revision cannot freeze a later timestamped observation.
5. Preserve provider price update times, reject invalid/future updates, prefer
   paired main lines. A stale provider quote stays stale even if received again.
6. Do not interpret a generic legacy veto or baseline-building window as proof
   of a statistics provider failure. Explicit incomplete/NO_STATS remains visible.
7. Correct full-win target for Asian .75 totals: Over 2.75 with total 3 is a
   half win; total 4 is needed for a full win. Current goals are counted once.
8. Identify fixtures in the five unique TOP attention slots, preserve expanded
   details and keyboard focus, expose input readiness and explicit blocked state.

## Verification

27 focused Node tests pass locally, including conflicts, stale expiry, cooldown,
cache bounds, input detachment, revision-domain transitions and quarter settlement.
The additive build reconstructs the exact original Mobile hash after removing
only the additions: `aa4f0f6318cd52c14ff62b195c5ea04c5267107455924da44c9aa78169fe7f28`.

Workflow for the candidate source:
https://github.com/Phuongdien1989/-football-edge-background-watch/actions/runs/39254406967

This workflow also checks existing provider/notification UI regressions, browser
interaction at 390/1280px and an isolated HTTPS preview release. Its results and
artifacts, rather than this source note, establish final CI/release status.

## Release boundary

Only the owned isolated preview Worker may change. Original backend, Mobile and
Desktop versions are checked before/after release. Preview has zero bindings and
connect-src none; it cannot run real scanner, Push or D1/provider calls.

Layout preview:
https://football-edge-ft-overview-preview.ngophuonghuy.workers.dev/app/#ftOverviewCard

Fictional data demo:
https://football-edge-ft-overview-preview.ngophuonghuy.workers.dev/

## Still required before a real recommendation release

- A genuinely independent PRE/LIVE goal-distribution model tested out of sample,
  with received-at replay, calibration/uncertainty and event response.
- A validated opportunity ranking and decision policy. Present TOP is attention
  priority by usable input completeness, not proven investment quality.
- Real-input acceptance, settlement-rule verification, outcome measurement and
  subsequent production acceptance. No live recommendations or new Push enabled.
- Existing upstream statistics rate-limit incident remains separate and unresolved.

Do not convert old market-influenced engine scores into an independent model,
declare model/market agreement sufficient for entry, or call this production.
