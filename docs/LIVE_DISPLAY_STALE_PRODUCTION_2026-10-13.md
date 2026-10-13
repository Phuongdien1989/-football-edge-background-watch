# Stale LIVE display — production completion, 2026-10-13

## Outcome
Frontend static asset deployment PASS.
Deployed source commit: edb82107e659c85ee318b94c385e0118c0ed4360.
Frontend active version: 03c1d55d-358a-448b-96f3-f356704831df, 100%.
Actions: https://github.com/Phuongdien1989/-football-edge-background-watch/actions/runs/38421436645
Regression Actions: https://github.com/Phuongdien1989/-football-edge-background-watch/actions/runs/38421436402
Public URL: https://shiny-silence-d892.ngophuonghuy.workers.dev/
Public HTML sha256: aa4f0f6318cd52c14ff62b195c5ea04c5267107455924da44c9aa78169fe7f28.
Independent workspace request also matched this hash after rollout.

## Exact scope
Existing 60-second freshness policy applied to active display lists/read bridge.
Expired selected fixture hidden from live display without deleting underlying histories.
Stale, unavailable or ended server snapshots cannot create new active LIVE items.
Fresh data can return retained fixtures to display; API errors do not falsely mark a fixture ENDED.
FT/H1/HC rendering only. Prediction models, thresholds, TOP/EDGE ranking and background scan behavior unchanged.

## Deployment correction
Previous module-wrapper uploads were accepted as Worker versions but public static assets still served the original HTML. Those attempts failed public verification and reverted to original frontend a3ffd320.
Complete user-provided project archive contained the prior proven assets-only deployment script and exact frontend bundle.
Published originals matched all three package hashes:
index.html 157af7294df17b997f505a6fa0a4658699c8236808a643e29ca2d71bd1b8b392
push-sw.js c2a193ef7464ebd0a41de358ea69c1d1f91a28866e70baf8e7cbb83499573ec9
manifest.webmanifest 2f8d30f69d89e49fa95194f09a8fb254bb3b313aa369b57b45337292fbaabc26
Used original Wrangler assets-only deployment protocol (not a response wrapper).
Only index.html bytes changed. Other two assets verified byte-identical after deployment.
No paid-plan changes. Original frontend version a3ffd320-54ec-4c5b-b7fd-eb6f95edb608 retained.
Original three-file backup plus candidate and complete result saved in deployment artifact.
Both one-time frontend deployment workflows disabled after completion; no automatic production retries.

## Remaining system issues — NOT claimed completed
Backend source remains 6b7accb869cf64598b7ca39d5326d6b4080313e1, no backend deployment in this task.
Backend rollback 60781a4e retained untouched.
Earlier health observed scan budget exhausted at 720/720, paused with next_alarm null; not reset or enabled here.
Provider Statistics / LIVE rate-error investigation and automatic signal PUSH delivery remain separate unresolved work.
A phone test PUSH was previously confirmed, but this release does not certify automatic alerts.
User should close/reopen the PWA to load the new HTML; no app/data deletion or API-key reset needed.
Phone-rendered outcome not yet independently confirmed.
