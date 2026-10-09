# TOP WATCH V1 — verified production checkpoint

Verified 2026-10-09 16:04 Asia/Ho_Chi_Minh (09:04 UTC).
Source commit: f05445e3498ba7934dc498ba75c371073ec5d735 on fix/production-notification-sync-20261009.
Workflow: https://github.com/Phuongdien1989/-football-edge-background-watch/actions/runs/37907856956 (attempt 2 SUCCESS).
Regression job 113746074369 SUCCESS; deployment/real verification job 113748448056 SUCCESS.
Independent full WebKit regression job 113745571823 also SUCCESS. First deploy-regression attempt timed out starting WebKit before app load; production remained untouched until successful retry.

Active frontend URL: https://shiny-silence-d892.ngophuonghuy.workers.dev/
Active frontend version: a3ffd320-54ec-4c5b-b7fd-eb6f95edb608.
Active frontend SHA256: 157af7294df17b997f505a6fa0a4658699c8236808a643e29ca2d71bd1b8b392 (independently retrieved exact live hash).
Backend unchanged: 491076a2-78d9-48f0-9050-ffc0f479c531.
Frontend rollback to exact pre-hide notification sync: 9b5bb5f1-fb53-4a54-9825-b0850ea28074; SHA256 09aaffa8791f64144072dacefa41ec7046ed313063d3c83aa28e68ee6cf3c8e1.
Do NOT use the older full-original rollback for this change; user selected the completed sync release before hiding research cards.

Evidence:
- 25 deterministic actual-generated ranking tests PASS, all inline scripts parse; engine/state/threshold/QSIG functions byte-identical.
- Full WebKit original UI at 375/390/1280 PASS; 60 outranks 58 but remains WATCH, confirmed=false; both included in Smart Follow selection. Authenticated canonical refresh, ordering, ended/stale/newer local guards, offline failure suppression PASS.
- Actual production WebKit sync OK: 17 canonical server snapshots. Missing-stat rows never displayed with a numeric goal score.
- Actual API LIVE list: 17 fixtures. Actual LIVE SCAN button completed: H1 0, FT 2, HC pool 9, workspace ON 2/3.
- Actual attention TOP: fixture 1507077, TOP #1, primary HC, LIVE GAP 41, confirmed=false. This demonstrates an unconfirmed observation enters TOP without signal promotion.
- Production frontend and push-sw/manifest hashes match candidate; backend version unchanged.

Limits: these are live observations at verification time, not guaranteed future counts or validated predictive performance. Physical iPhone push-click behavior has not been independently retested. Actual backend Smart Follow registration was not independently exercised in this run; its unchanged orchestration consumes the same ranking, and selection was tested in full WebKit.

Rollback evidence (exact pre-hide HTML + deployed version inventories + test logs) is in workflow artifact fe-top-watch-verification-and-exact-rollback, retention 90 days. Pre-hide source remains reconstructible at Git commit ab73b5335dd7f2bac7ee3220f0eb0d8e930d0e0b; frozen original rollback/index.html untouched. Production core, push thresholds, Entry Policy, CSS/layout, visible research cards, and no-R2 invariant retained.
