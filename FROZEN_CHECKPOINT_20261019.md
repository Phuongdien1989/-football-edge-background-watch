# FOOTBALL EDGE — FROZEN CHECKPOINT 2026-10-19
Requested by owner at 15:31 Asia/Bangkok. Preserve this checkpoint while specifying the next feature.

## Deployed application — last verified state
- Backend source: da5242bb41b2401271f52dda17b0e2208e7e3819
- Backend Cloudflare version: 04cc044d-412f-4844-9b83-c7c786eedd13 (100% at last verification)
- Immediate backend rollback: 2be01a61-cc5d-43c7-9c6d-13e581296453
- Rollback source: 3c97629e51251c56f9edeb8d0f67a7a0dad957a2
- Older rollback: 60781a4e-70cb-4c02-a036-2528c3048ed5
- Original Mobile version: 03c1d55d-358a-448b-96f3-f356704831df
- Mobile URL: https://shiny-silence-d892.ngophuonghuy.workers.dev/
- Original Mobile HTML SHA256: aa4f0f6318cd52c14ff62b195c5ea04c5267107455924da44c9aa78169fe7f28
- Desktop version: a332ee39-abb2-422d-a021-db78ef19cc10
- Last scanner observation: OFF; next_alarm=null.
- Cloudflare Free retained.

## Source and evidence
This branch preserves source and diagnostics at f86ecd8efb15f86ad5e53a2cd80ead97795215ac plus this documentation only. It is not a new production deployment.
- Runtime release/regression: https://github.com/Phuongdien1989/-football-edge-background-watch/actions/runs/39206110986
- Broad regression: https://github.com/Phuongdien1989/-football-edge-background-watch/actions/runs/39206714319
- Push transport accepted by Apple: https://github.com/Phuongdien1989/-football-edge-background-watch/actions/runs/39206708894
- Isolated statistics probe: https://github.com/Phuongdien1989/-football-edge-background-watch/actions/runs/39216191045

## Known limitations, intentionally preserved
Statistics remains blocked: one physical /fixtures/statistics?fixture=1555512 request after 121796ms quiet interval returned HTTP 200 with explicit subscription per-minute rateLimit error, at 2026-10-19T07:30:32.836Z–07:30:33.563Z. No quota or Retry-After headers; response DYNAMIC and fresh. No burst from this controlled test. Key/IP/provider-rule cause is not identified. Do not claim statistics or complete LIVE/PUSH restored.
Apple accepted the single authorized test; actual phone display remains unconfirmed.
PR #9 central paper measurement remains staging-only/incomplete; no verified stable betting profitability.

## Freeze rules
No production deployment, configuration change, data deletion, scanner toggle, or additional provider probe is part of this freeze.
Preserve original Mobile/Desktop, TOP/EDGE, thresholds, prediction logic, history, scan cadence, and rollback.
Develop a new feature on a separate branch from the applicable source checkpoint, with isolated preview/staging and acceptance before production.
Freezing source does not suspend an active service or snapshot live D1 contents. No database backup is claimed here.
