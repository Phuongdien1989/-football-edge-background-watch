# P2052 notification synchronization — production checkpoint

Verified 2026-10-09, Asia/Bangkok.

Production deployed from commit 72596b2bfb7b5766a059576747347c0a299354da.
Branch: fix/production-notification-sync-20261009.
Original main is unchanged: e8ce008bcf567ee71880f0cf16323d774382494e.

Frontend: https://shiny-silence-d892.ngophuonghuy.workers.dev/
Active frontend version: 9b5bb5f1-fb53-4a54-9825-b0850ea28074.
SHA256: 09aaffa8791f64144072dacefa41ec7046ed313063d3c83aa28e68ee6cf3c8e1.
Original frontend SHA256: a82bf87e1db875fb975b94ac9b6df9e785818de37b7bb55fec6f290efca9c844.
Original complete frontend is retained in sync-fix/rollback/index.html.
CSS and DOM layout reverse exactly to original P2052. No R2.

Backend: https://football-edge-background-watch.ngophuonghuy.workers.dev/
Active backend version: 491076a2-78d9-48f0-9050-ffc0f479c531.
Entry: worker_notify_v138_sync.js, extending original V137 quota50000.
Scoring, thresholds, quota and native push transports remain inherited.

Rollback baseline backend version: 37c473f4-f2f7-4b77-a441-fc50baf48974.
This is the exact original root V137 source redeployed after the legacy version
6c1b74e6-4327-4ce2-b5d7-5dc42803cf13 returned Cloudflare 10210 Version not found.
Rollback to 37c473f4-f2f7-4b77-a441-fc50baf48974 was actually verified during the failed smoke attempt.
Original frontend rollback version: c1ab7df6-d13d-436c-a656-c42a547b3420.
Original frontend rollback source is retained even if an archived version expires.

Validation:
- Exact original-UI reversal passed.
- Worker import, auth, commit-before-push, canonical readback, version deep links,
  out-of-order protection, empty/full provider cases passed.
- Full original WebKit UI regression passed at 375, 390 and 1280.
- Service-worker payload/open/focus/deep-link/same-origin checks passed locally.
- Production HTTP/hash/assets smoke passed: run 37890848661.
- Real production WebKit app reading real authenticated backend passed: run 37891025928.
  Sync OK; 3 canonical rows; H1 3, HC 3, FT 0 (actual live feed was 1H).
  One actual row had statistics OK; two had statistics EMPTY and displayed no score.
- Actual FT state transitions were covered by regression; no real 2H fixture was available for that production browser run.
- Physical iPhone receiving/clicking a real notification is NOT YET VERIFIED.

Temporary old-code HTTP 405 responses occurred during deployment propagation.
Deployment gate now waits for the new schema before deploying the frontend.
No successful deployment should be inferred solely from a Wrangler accepted upload.
