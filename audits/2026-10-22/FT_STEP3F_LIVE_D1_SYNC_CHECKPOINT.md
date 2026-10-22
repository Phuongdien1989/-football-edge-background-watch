# Football Edge — Step 3F D1 Free production sync forensic checkpoint
Date 2026-10-22, 18:55–19:00 Asia/Ho_Chi_Minh. PR #16 Draft only. **NO production deploy/merge/scanner/on/off/data writes.**

## 1. LIVE deployed state checked directly (read-only)
- [GitHub Actions independent Cloudflare read-only verification PASS](https://github.com/Phuongdien1989/-football-edge-background-watch/actions/runs/39774187387), 2026-10-22 11:55 UTC.
- Worker `football-edge-background-watch`: version `e7d2090c-d0e1-4f58-9f5a-4360acd2ced3` 100%; live `/health` deploy commit `3cd210d2d74aff547de4587ab4a3c96b982a728c`.
- Scanner status: `enabled=false`, `manualEnabled=false`, `next_alarm=null`. Verify other automation separately; this is the health snapshot.
- Worker `shiny-silence-d892` (Mobile): version `3166663f-f039-48f5-92ae-888890bb9455` 100%.
- Previously confirmed backend version `02d56762-ba08-4a8d-8654-bc9d522fc29a` available for rollback. Earlier version check first timed out, then segmented one-shot succeeded.
- No D1 SQL/API-Football calls, writes, deploy or scanner toggles.

## 2. Significant new finding: production source guard is NEWER than old PR #6
- Github PR #6 `79cd4ddfa4191fa5a6e620683947d77e6ecbf31c` remains OPEN/DRAFT (not merged); not evidence of what was deployed.
- Compared exact `worker.js` **Git blob** at live production commit `3cd210d...` against PR #6 source: blobs differ. Production-base source has:
  - `entry_decisions.payload_json IS NOT excluded.payload_json`
  - `d1SourceRevisionAllows('entry_decisions')`
  - reject OPEN/PENDING replacement of stored RESOLVED decision
  - `entry_outcomes` payload/revision guard.
- PR #6 `worker.js` has older idempotency guard but **does not include the later production source_revision/RESOLVED rules**. **DO NOT deploy PR #6 wholesale** over current production: could regress safeguards.
- New `test-prod-backend-d1-guard.mjs` added to FT candidate CI to flag future branch changes removing these protections. Static source verification is not runtime row-cost certification.

## 3. Measured live account D1 write cause
- 2026-10-22 [account read-only D1 analytics PASS](https://github.com/Phuongdien1989/-football-edge-background-watch/actions/runs/39753095391): production D1 `FOOTBALL_DB` **102,066 rows written**; isolated FT test DB **28**; total **102,094**. Prior day production 134,294. Adaptive analytics may lag and differ from billing counters.
- [SQL group read-only attribution PASS](https://github.com/Phuongdien1989/-football-edge-background-watch/actions/runs/39753374035): `INSERT entry_decisions` 11,954 executions / **95,632 rows written** on 2026-10-22 (~93.7% of 102,066); `live_snapshots` 4,970; `fixtures` 250. `entry_decisions` has primary key and six listed indexes in `schema_v1231.sql`. Cost is about eight billed writes per observed INSERT, but **does not prove duplicate event share**.
- Main API route source: `worker.js` POST `/api/db/sync`, `dbWriteEvents()` recognizes `ENTRY_DECISION` and invokes `dbEntryStmt`.
- Existing rollback/idempotence guards are insufficient to keep the observed **daily production row count** under Free. Need distinguish genuinely new decisions from repeated changing payloads and legitimate outcome corrections, not blind rate limiting.

## 4. Mobile source verification limitation
- [Mobile code markers run](https://github.com/Phuongdien1989/-football-edge-background-watch/actions/runs/39774614506) authenticated GET `/workers/scripts/shiny-silence-d892/content/v2` returned HTTP success but **zero-byte response**. This check **CANNOT verify** whether current Mobile has `feDbEntryFingerprint`, atomic IndexedDB ACK or legacy outbox. Mark **SOURCE_UNVERIFIED**, not PASS.
- Historic `mobile-outbox-candidate/build_mobile_candidate.mjs` and prior [D1 sync staging report](../../docs/D1_SYNC_FIX_REVIEW_2026-10-16.md) show desired source fingerprint, late-ACK protection and atomic ACK behavior. This candidate is NOT proof deployed to current Mobile version.

## 5. Cloudflare Free blocker
- [Real isolated D1 pair write failure](https://github.com/Phuongdien1989/-football-edge-background-watch/actions/runs/39752436723): HTTP 400 code 7500 at 2026-10-22 09:03 UTC, `account has exceeded D1's free tier daily row write limit`. No new pair schema or pair data created.
- Since this diagnosis, only GET Cloudflare API / GraphQL analytics requests and Github CI mock tests were made, **zero production D1 writes**. Do not attempt remote D1 SQL writes today.
- D1 Free write limit 100,000 rows/account/day; UTC reset, potentially access restored 07:00 next Vietnam morning, but must first verify measured headroom and production volume.

## 6. Next implementation order — keep code scopes separate
A. Identify *live* Mobile source/outbox via verified deployed HTML/asset (not an unversioned staging copy), using read-only authorized retrieval that does not initiate scan or mutation; classify whether fingerprint and atomic ACK are present.
B. Quantify new unique entry IDs versus repeated different payload revisions via privacy-preserving bounded metadata/histograms, within D1 read quota. Existing D1 aggregate counters cannot distinguish source retransmissions from genuine new decisions.
C. Prepare **Mobile-producer-only** ACK/fingerprint patch against current live Mobile version (NOT stale Oct16 HTML hash); strict pinned baseline, tests for null/0, corrections, lost ACK and no future leakage. A backend patch is unnecessary unless fresh evidence contradicts current source guard.
D. Independent approval and deployment only after rollback/current deployed hash verification, correct D1 daily usage evidence and full regression. Production changes remain on HOLD.
E. Resume FT AI V2 paired recorder remote measurements only when Free write quota can genuinely accommodate them and the user approves a bounded isolated write test; do not prioritize new FT writes while production is already at quota.
