# Stale LIVE display checkpoint — 2026-10-13
## Scope and code
User authorized correcting stale LIVE presentation and stale snapshot reinsertion; preserve frontend design, engines, TOP/EDGE, history, backend and Free plan.
Source commit: 92c4ccda39e70b063c563ac219798707dabd2d0a.
- .github/scripts/live-display-patch.mjs: exact-anchor transform, existing 60-second freshness guard, retained underlying arrays/history, no false ENDED assignment on API failure, stale/ended new snapshots cannot recreate active cards.
- Detached FEUIReadBridge excludes expired display items and stale selected fixture; legacy FT/H1/HC render paths filtered only. Engine/scheduler/ranking methods unchanged.
- .github/scripts/test-live-display.mjs: PASS on actual production HTML; stale 3166-second fixture hidden, fresh recovery preserves history, terminal/future rows excluded, stale sync cannot create items, all inline scripts parse.
- Regression Actions PASS: https://github.com/Phuongdien1989/-football-edge-background-watch/actions/runs/38417987222

## Deployment evidence and blocker
Latest deployment Actions FAIL: https://github.com/Phuongdien1989/-football-edge-background-watch/actions/runs/38417987141
Original serving HTML sha256: 157af7294df17b997f505a6fa0a4658699c8236808a643e29ca2d71bd1b8b392
Candidate HTML sha256: aa4f0f6318cd52c14ff62b195c5ea04c5267107455924da44c9aa78169fe7f28
Frontend rollback: a3ffd320-54ec-4c5b-b7fd-eb6f95edb608
Attempted frontend version: 6821967f-5936-4f72-91dd-b0e2bc52e226 (API reported 100%).
All 24 public URL checks returned HTTP 200, ORIGINAL hash, no FE_LIVE_DISPLAY_FRESHNESS_V1 marker and no x-fe-live-display header. Request cache-control no-cache and unique query strings did not obtain candidate.
Independent HTTP response reports cf-cache-status HIT, cache-control public,max-age=0,must-revalidate.
This demonstrates an unverified link between Worker code deployment and the currently served static frontend, NOT proof of which cache/routing configuration is responsible.
Deployment failed its public-hash gate and restored original frontend version a3ffd320-54ec-4c5b-b7fd-eb6f95edb608.
A previous packaging rejection 10021 (duplicate module) was corrected; latest failure is public delivery, not duplicate module or proven token-permission failure.
Old static assets retained via keep_assets; no existing asset bundle was replaced/deleted. Staged uploaded candidate may remain inactive in Cloudflare version history.
Full evidence and source backup artifacts attached to failed deployment workflow. Uploaded content API represents latest staged source, not necessarily original active version; do not confuse these in a continuation.

## Backend unchanged
No background Worker deployment or data migration in this task. Backend source remains 6b7accb869cf64598b7ca39d5326d6b4080313e1; original backend rollback 60781a4e retained.
Observed backend has exhausted 720 scan cycles/day and no next alarm. This presentation patch does not reset scan budget, enable scanning, change API quota, or fix provider Statistics failures.
Automatic signal PUSH remains unverified; prior test PUSH confirmed.

## Resume requirement
Confirm the actual frontend hosting/deployment route for https://shiny-silence-d892.ngophuonghuy.workers.dev/ and current static-asset deployment, before further writes. A Cloudflare frontend Worker Deployments/Settings screenshot or authorized direct dashboard access can help establish the serving configuration. Do not ask user to paste tokens, delete cache/app data, upload an incomplete asset bundle, or change thresholds.
One-time deployment workflow is disabled to prevent automatic repeated production attempts. Tests and transformation saved; do not redo them.
