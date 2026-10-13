# UI sync correction — 2026-10-13

Production code: 6b7accb869cf64598b7ca39d5326d6b4080313e1.
Cloudflare version: 5f33a4b1-a299-4195-8a68-4646396a9214 (100%).
Original rollback retained: 60781a4e-70cb-4c02-a036-2528c3048ed5.
Test/deploy: https://github.com/Phuongdien1989/-football-edge-background-watch/actions/runs/38363813294

## Fixed and verified
1. Existing frontend GET /api/notify/ui-state previously returned HTTP 405. Production now returns HTTP 200 and FE_NOTIFY_UI_STATE_V1.
2. Publish the exact fixture snapshot and engine evaluations used by the notification scan. GET reads D1 via existing state accessors; it never fetches API data or recalculates predictions. Per-device FT estimate is selected without exposing another device's calibration. Old/error records never become fresh snapshots.
3. HC validation now reads D1-aware state instead of frozen legacy DO records.
4. Statistics provider failures now become ERROR/source warnings rather than valid EMPTY.
5. Unchanged frontend state-core accepts candidate snapshots; stale/error, revision ordering, tombstone, no provider call and HC migration tests PASS.

Frontend, TOP/EDGE, scoring/thresholds, legacy DO and rollback data unchanged.
Manual scan OFF remains OFF; no automatic cron.

## Actual production limitations
GET verified with zero published snapshots and 50 pending rows while paused. This proves the endpoint correction, not live source recovery.
One isolated strict Statistics request for fixture 1576501 resulted in two bounded physical attempts, max one start/second. Both still returned HTTP 200 API_PROVIDER_RATE_LIMIT; quota/Retry-After headers absent.
No current scan was enabled or automatic alert claimed. Device test delivery was previously confirmed by user on 2026-10-12.

## Continue here
Compare the same Statistics request and credential outside the Worker path to isolate request/key/network behavior. Need a successful source response before exercising exact threshold crossing, automatic Push and dedup on a real fixture.
Do not repeat passed tests unless the changed component warrants it. Do not change thresholds to force alerts or upgrade plans without evidence.
