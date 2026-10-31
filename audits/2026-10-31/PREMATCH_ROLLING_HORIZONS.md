# PRE-MATCH rolling scan horizons — 31 October 2026

User request: replace manual date/time inputs with 1/2/3 upcoming hours relative to the present.

## Behavior

- Three buttons: 1 giờ tới, 2 giờ tới, 3 giờ tới; default 1 hour.
- Selecting a preset changes preference only; no API request, scanner toggle or recurring job starts.
- Pressing Quét PRE-MATCH captures Date.now() once and constructs [from, from + hours), preserving exact milliseconds. Display uses Vietnam time. New scans always get a fresh anchor, rather than retaining an old prefilled clock.
- Quét tiếp uses the original catalog and anchor for that scan. Selecting a different preset disables continuation until a new scan starts. Expired windows require a fresh scan.
- Active scan results exclude unrelated cached fixtures, out-of-window fixtures and unprocessed cache-only fixtures. Per-fixture quotes and contexts are restricted to displayed IDs. Cached data/history is retained, not deleted. Results and their last applied window survive tab switching within the page session.
- Existing cap of five fixtures and 40 new requests per explicit batch remains. Stop, cache reuse, model review and all market-family pricing remain unchanged.

## Scope

Three published assets changed: prematch-release/production.mjs, prematch-scan/collector.mjs (pure rolling-window helper only), prematch-ai/view.css. No changes to the prediction engine, payout math, FT/HT/AH/OU recommendations, source API configuration, backend, LIVE mechanisms, Push, scanner cadence, D1 schema or production history. Seventy public assets preserved.

## Verification

Pure range tests cover exact 1/2/3h intervals, fresh click anchors, VN midnight, inclusive start/exclusive end and stable continuation catalog. Browser tests cover preset selection without calls, absence of date/time fields, default 1h, fresh click timestamp, unchanged continuation anchor, and a new 3h window. Two injected QA cached fixtures (one outside the window, one not processed) must not enter active results. Existing scan, family controls, cancellation and legacy mechanism browser regressions are retained. Provider responses in browser tests are QA mocks; no new real provider probe was made.

The first attempt failed a CSS selector in the test before deployment, not the deployed app. It was corrected before release. Untouched model/settlement test suites were not re-run for this UI-only change; public hash acceptance verifies those assets remain unchanged.

Rollback predecessor: f80e082e-3492-422d-9ecc-11a0549ad12d.
Deployed source: 30739d3dfb5b2858289a9af20baccb762123f84a.
Workflow: https://github.com/Phuongdien1989/-football-edge-background-watch/actions/runs/41179830896

## Final acceptance

Mobile version 28b182ba-1ea7-4c56-8d90-9d69e5493865, 100% traffic, VERIFIED. Source 30739d3dfb5b2858289a9af20baccb762123f84a. Workflow 41179830896 PASS.
Candidate and published browser acceptance PASS at 320/390/540/900/1440px. Only three intended assets changed; all 70 public hashes verified. Backend source, scanner OFF and control timestamp 1793429059923 matched before/after. Rollback f80e082e-3492-422d-9ecc-11a0549ad12d retained.

Use: reload https://shiny-silence-d892.ngophuonghuy.workers.dev/#fe-tabs/prematch, select 1/2/3 giờ tới and press Quét PRE-MATCH. The displayed interval is captured at the click. Quét tiếp retains that interval; a fresh Quét captures a new present-time anchor.
