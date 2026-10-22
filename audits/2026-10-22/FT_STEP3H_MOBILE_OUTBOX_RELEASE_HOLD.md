# Football Edge — Bước 3H: Mobile Outbox final QA / release hold

Date 2026-10-22. Branch `fix/ft-foundation-20261021`, PR #16 Draft.

## Final verification
- Final GitHub Actions run **PASS**: https://github.com/Phuongdien1989/-football-edge-background-watch/actions/runs/39788931079
- Review artifact (candidate and original HTML, README, SHA256SUMS): https://github.com/Phuongdien1989/-football-edge-background-watch/actions/runs/39788931079/artifacts/12430666044
- Archive artifact ID `12430666044`, size `689650` bytes. This is GitHub artifact storage, **not** production.
- Source production public HTML: `005a74b4768a00f92ac462592b3de63106b2a4db35732103f6095cfed9fdb46d`, bytes `1353667`.
- Candidate HTML: `d5dd7761ea2296aab2762564457f92c778c1065f3112bba61e6cdd0a13535752`, bytes `1355818`.
- Exact diff reversal QA PASS, `unchanged_entire_rest=true`, `unintended_ui_changes=0`. Only `ENTRY_QUEUE`, `ATOMIC_ACK_INSERTION`, `SYNC_ACK_CALL` altered.
- Functional IndexedDB QA PASS: duplicate suppression, lost ACK, late ACK preserves newer revision, legitimate PENDING→RESOLVED and correction, null/zero distinction, complete batch ACK.
- Shared ACK QA **5/5 PASS** for LIVE_SNAPSHOT, QSIG_RESULT, late QSIG revision, mixed ENTRY+LIVE, and empty ACK.
- FT foundation CI on candidate branch was PASS before final mobile test and changes were confined to staged Mobile QA files.

## Risk boundaries
- **NOT DEPLOYED**. No changes to backend production, Mobile production, D1, scanner, HT/HC, TOP, Push, or rollback deployment.
- Current backend `3cd210d2...` already has stronger source revision / RESOLVED guard than PR #6. Never blindly replace production backend with older PR #6.
- Account Free D1 row writes exceeded 100k on 2026-10-22; production `entry_decisions` dominated account D1 write telemetry. Reduction from candidate Mobile patch is **NOT measured on natural workload**. New IDs and valid corrections are preserved and continue writing.
- ZIP contains full deployed-public HTML at audit time and generated candidate. It is a release-review artifact; no release operator should use it without drift/rollback verification.
- UI is preserved byte-for-byte outside exact Outbox changes. This is **not** real-device QA; iOS IndexedDB persistence, error recovery, pushed notifications and device behavior remain unverified.

## Proposed 3I acceptance before optional separate Mobile-only deploy
1. Confirm current active Mobile Worker version and public HTML SHA against pinned baseline **at deployment time**; abort on drift.
2. Run device smoke checks, backend current-commit regression, existing TOP/EDGE/Push checks; verify rollback route and user's current deployment permissions.
3. Gather privacy-safe real send/ACK/entry-id statistics without new persistent D1 write paths, enough to distinguish duplicate retransmit vs legitimate new decisions and to calculate effective rows-written decrease after any separately approved deploy.
4. Recheck Cloudflare account D1 quotas/other apps and use the existing Free plan; do not enable FT replay writes while quota remains exhausted.
5. **Ask for explicit owner approval separately** for Mobile-only production deployment and bounded verification; do not merge PR #16 as an accidental deployment carrier.

## Current gate
- Candidate build/CI/review ZIP: **PASS**
- Mobile production deployment: **HOLD**
- Real account D1 ROI/savings, on-device QA: **UNVERIFIED**
- FT AI V2 Tài/Xỉu paired replay remote validation: **BLOCKED by Free write quota**
