# FT OVERVIEW — real stored-input checkpoint, 19 October 2026

Tested source: `cc73ae302c27db7dade5d42842f176564545bc1d`.
Workflow: https://github.com/Phuongdien1989/-football-edge-background-watch/actions/runs/39257004406
All three jobs (QA, read-only real-input capture, isolated preview/HTTPS smoke): PASS.
30 focused tests plus existing provider/notification UI regressions and browser checks: PASS.

## Actual production D1 findings

- The latest 50 match-state rows did not provide usable published UI snapshots.
- A separate SELECT filtering all stored match state for published UI objects returned zero rows.
- The bounded SOURCE_DETAIL fallback read 50 real historical rows, normalized with unchanged backend helpers into 19 distinct fixtures.
- Source observation window: 2026-10-17 12:54:50.152–15:09:41.324 UTC.
- At capture on 19 October: 15 STALE and 4 ENDED; current TOP empty.
- Statistics: 1 OK from stored statistics presence, 14 UNAVAILABLE, 4 explicit stored ERROR.
  UNAVAILABLE is not proof of a provider rate-limit error.
- 5 fixtures have a paired FT total quote in the retained observation. Quotes are historical, not current executable prices.
- No source score mismatches found in this sample.
- No independent model supplied by this stored capture; no live recommendations.
- Final capture: 32,265 rows read, 0 rows written, 2 SELECT queries.
- Provider calls: 0. No scanner, Push or production deployment change.

This is bounded evidence from stored data, not a complete account-wide data inventory.
It does not prove whether a user's open browser currently has newer local snapshots.
It does not diagnose the cause of the earlier upstream rate-limit incident.

## Reviewable result

Real stored replay:
https://football-edge-ft-overview-preview.ngophuonghuy.workers.dev/replay.html

The archive uses original timestamps, labels old data, permits fixture selection even with empty TOP, and shares no session storage with the live-input candidate.
The public replay contains only whitelisted football data, never devices, tokens, subscriptions or original private payloads.

Preview version: `b0d81264-5bf6-4722-925b-700781ad8528`.
Original backend, Mobile and Desktop versions were verified unchanged before/after.
The isolated preview has zero bindings and connect-src none.

## Blocking real LIVE acceptance

Fresh snapshots containing statistics, matched current FT prices and usable historical context are absent from this captured sample.
The owner's normal app must first receive fresh data during an owner-initiated scan to permit LIVE input acceptance.
Do not auto-enable scanning, substitute stale archives for fresh input, invent missing probabilities, or call attention-order TOP a validated investment ranking.
Independent model calibration, opportunity ranking/outcome evidence and LIVE/PUSH acceptance remain incomplete.
