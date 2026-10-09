# LIVE scan incident and pre-collapse UI rollback

2026-10-09 14:22 Asia/Ho_Chi_Minh: user reported LIVE scanning unavailable and
authorized restoring the previous production UI.

- Frontend restored to 9b5bb5f1-fb53-4a54-9825-b0850ea28074 (pre-collapse sync UI).
- Verified public HTML SHA256: 09aaffa8791f64144072dacefa41ec7046ed313063d3c83aa28e68ee6cf3c8e1.
- Backend unchanged: 491076a2-78d9-48f0-9050-ffc0f479c531.
- Rollback workflow: 37898633443, job 113715730509, SUCCESS.
- Actual backend /api/notify/status HTTP200: scanEnabled true, paused false,
  scan errors LIVE_DISCOVERY_UPSTREAM_ERROR:EVIDENCE_PROVIDER_ERROR.
- Worker global quota used 12639/50000, remaining 37361. This is the Worker
  reservation counter, not verified provider account remaining quota.
- /api/notify/ui-state HTTP200: live_count 0, 3 prior snapshots inactive.

The original worker api implementation throws EVIDENCE_PROVIDER_ERROR on a
provider response containing non-empty errors, without retaining detailed error
messages on the strict path. The cause cannot yet be distinguished between a
provider account/key/quota issue from these status responses alone.

The client's scan function uses its locally configured Football API key directly;
its TEST API displays provider errors in full. User should run TEST API and provide
the error text/screenshot (never the API key) if scanning remains unavailable after
reopening the restored application. No successful real LIVE scan is claimed.

The collapse implementation remains in Git history d3d2779 for review, but the
default source build is restored to the deployed pre-collapse UI.
