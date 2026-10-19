# FT OVERVIEW — usable same-origin shadow page

Tested source: `aa78295612808155b32cd0ea8bcd6ea41c03bc5f`.
Workflow PASS: https://github.com/Phuongdien1989/-football-edge-background-watch/actions/runs/39260925016

## What is now available

https://shiny-silence-d892.ngophuonghuy.workers.dev/ft-overview-live/#ftOverviewCard

The original app plus a collapsible FT OVERVIEW card is served under the same origin. Existing origin-local configuration remains available. The original root URL still serves byte-identical original Mobile HTML (SHA256 aa4f0f6318cd52c14ff62b195c5ea04c5267107455924da44c9aa78169fe7f28).

This is a usable research/shadow view, not the fictional demo or a locked layout preview. It reads existing browser snapshots and previously fetched DEEP contexts. The addon itself makes no provider requests, writes no D1 and sends no Push. The original app's normal API/scanner operations remain under the owner's controls. Only run the intended app tab to avoid duplicate original foreground work.

Use Safari to open the new URL, scan using the existing controls, open a real match/run the existing DEEP action, then open FT OVERVIEW. Missing or stale statistics/price/model remain visibly waiting. No new live bet recommendation is enabled.

## Verified release

- Frontend active version: `ac8c0da2-551c-4561-a554-efd4c09339ad`, 100%.
- Original root HTML exact hash restored/preserved.
- Push service worker and manifest exact bytes preserved.
- Original HT/FT/HC cards and detached bridge present; no horizontal mobile overflow.
- 30 focused data tests and real HTTPS browser smoke PASS.
- Backend version remains 04cc044d-412f-4844-9b83-c7c786eedd13.
- Desktop version remains a332ee39-abb2-422d-a021-db78ef19cc10.
- No scanner toggle, provider probe, Push or D1 write performed by release/smoke.
- Version 03c1d55d-358a-448b-96f3-f356704831df still exists. This final release did not rehearse a rollback to it; the full pinned original HTML is now stored in git and the released static bundle is in the workflow artifact.

## Release issue resolved

Script/content/settings and keep-assets reuse can refer to the latest uploaded artifacts, even when traffic has rolled back to an earlier version. An older Premium asset manifest was observed (HTML SHA256 a9b82cdb5fb6c4742ba8ba1e960fa5f60406204d8bd8ec0f7f62f2d709c6ce7b). The initial handler/keep-assets approach was abandoned. The successful implementation publishes an explicit static bundle containing the pinned original root, current Push assets and an opt-in page. No runtime wrapper is used.

## Limits and continuation

The model remains uncalibrated research, TOP is input-completeness attention order, and the upstream statistics incident remains unresolved. Do not claim forecasting profitability, restored LIVE/PUSH or a complete recommendation engine from this UI release.

Known stored-data audit: 19 historical fixtures from 17 October, no eligible current TOP. Fresh browser observations during owner-initiated use are required for live acceptance.

Future deployment guards that pin Mobile 03c1d55d must account for this intentional new static version; do not blindly treat latest-upload content as the active baseline.
