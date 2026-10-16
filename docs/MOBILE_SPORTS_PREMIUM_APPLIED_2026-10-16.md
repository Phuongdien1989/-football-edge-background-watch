# Football Edge Mobile Sports Premium applied 16 October 2026

The owner requested direct completion and application in this conversation. Only the original Mobile frontend Worker was changed. No backend deployment, scanner command, subscription registration, or Push test was performed.

## Active release
- Application: https://shiny-silence-d892.ngophuonghuy.workers.dev/
- Mobile version at verification: `8fc5b2ca-1ddb-4c0b-b161-c71141462ae5`, 100% traffic.
- Deployed source commit: `80d8f60ca6fdb7072889ac66383585519782425d`.
- Runtime QA source: `b6c7501bab1b90f7b6c6173347e68e5b72406ede`.
- HTML SHA-256 independently downloaded after release: `d3ccb4205e993b3fd4a835be2853398945c2069d0b335f304c181d6077075efd`.
- Preview remains separate: https://football-edge-mobile-sports-premium-preview.ngophuonghuy.workers.dev/

## Changes
Readable mobile typography and tap targets; compact header; TOP 1 with truthful DQ /5 units, translated entry state, consistent stale/unknown freshness; read-only paired statistics; native five-tab navigation. Real-use build always uses production mode, hides demonstration controls and never substitutes demo fixtures. Original desktop presentation remains above the mobile breakpoint.

The production builder proves a byte-identical round trip of the original HTML after removing only the additive CSS, presentation script and native read/selection bridge. All original engine, ranking, thresholds, Outbox, Push, SW and automatic sync code is retained.

## Evidence
- Chromium / WebKit, 375/390/430/1440, five routes, zero/null handling, baseline fixture/ranking parity, production-mode and source-integrity QA: https://github.com/Phuongdien1989/-football-edge-background-watch/actions/runs/38875556351 — SUCCESS.
- Release and actual HTTPS acceptance at 390/1440: https://github.com/Phuongdien1989/-football-edge-background-watch/actions/runs/38875822225 — SUCCESS.
- Release artifact ID: 12035775096 includes original static backup, version manifest, build manifest and actual HTTPS screenshots.
- Same-origin `push-sw.js` remains SHA-256 `c2a193ef7464ebd0a41de358ea69c1d1f91a28866e70baf8e7cbb83499573ec9`.
- HTTPS empty-config acceptance observed zero API calls and zero page errors; this does not certify all configured runtime behavior.

## Preserved versions
- Mobile immediate rollback: `03c1d55d-358a-448b-96f3-f356704831df`; baseline HTML SHA-256 `aa4f0f6318cd52c14ff62b195c5ea04c5267107455924da44c9aa78169fe7f28`.
- Desktop B2: `a332ee39-abb2-422d-a021-db78ef19cc10`.
- Backend: `2be01a61-cc5d-43c7-9c6d-13e581296453`.
- Pre-finish source preserved at branch `checkpoint/mobile-premium-before-finish-20261016` / `bc2f1e1ba0b95a4a07ed080cb310e1ac6254c542`.

## Practical limits and rollback
Real iPhone Safari/PWA, configured LIVE/DEEP/Copy and actual Push delivery have not been exercised by this release. No claim of improved prediction quality or quota savings is made. Existing same-origin data and permissions were not cleared or migrated.

If necessary, restore the immediate Mobile rollback version to 100% through the existing Cloudflare version deployment API, then verify baseline HTML hash and unchanged Push SW. A frontend rollback is separate from reverting any database records; this release contains no database migration.

Open the original app URL and refresh, or close/reopen its PWA. Do not clear storage, reset credentials or reinstall merely to see the presentation update.
