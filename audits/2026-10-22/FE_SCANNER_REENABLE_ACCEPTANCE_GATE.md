# Football Edge — Scanner re-enable gate after Mobile Outbox release
Date: 2026-10-22 (Asia/Ho_Chi_Minh). Scope: verification and acceptance only, NO scanner activation.

## Confirmed
- Mobile-only Outbox release PASS in GitHub Actions run 39791743265; Mobile version e1beb5bf-3617-4c54-805a-623cfafd7411, rollback 3166663f-f039-48f5-92ae-888890bb9455.
- User visually confirmed Mobile UI works. This is not telemetry validation of actual IndexedDB sync or actual billable D1 savings.
- Most recently measured D1 Free total 2026-10-22: 102,094 rows written vs allowance 100,000; production entry_decisions dominated with 95,632 rows written and 11,954 SQL inserts at time of measurement.
- Health at earlier post-deployment baseline reported scanner OFF. The new GitHub independent read-only check run 39792689144 was still QUEUED when checked, so latest scanner state is NOT independently verified.
- No authorization to enable continuous scanning or to deploy FT AI V2; PR #16 remains Draft.

## Operational go/no-go before a single short manual scan
1. After the D1 Free daily reset at 00:00 UTC (07:00 Vietnam), verify fresh day/date account-wide D1 rowsWritten using Cloudflare read-only analytics. If data is delayed, unknown or near the limit, STOP. Historic 2026-10-22 aggregate >100k is not evidence of subsequent day's availability.
2. Confirm backend active version and /health 200, current scanner OFF, absence of unexpected alarm, Mobile version e1beb5bf-3617-4c54-805a-623cfafd7411, preserved rollback and no D1 errors during read-only checks. Unknown = STOP.
3. Inspect POST /api/db/sync results and client pending queue locally on device, without clearing IndexedDB. User confirmation of visible UI cannot establish sync ACK behavior.
4. Compare new local/UTC-day rowsWritten before/after controlled window with indexed entry_decisions breakdown. Keep sample new entry IDs vs legitimate PENDING→RESOLVED outcomes separate from retransmitted identical payloads; never delete genuine decisions/corrections.
5. Only owner-directed, manually limited scan of a few fixtures, with scanner immediately set OFF after the bounded window and metrics collected. No continuous or automatic peak restart.
6. Stop/rollback on D1 code 7500, rapidly increasing row-write counts, stuck Outbox, missing new decisions, or regression in HT/HC/FT, TOP or Push. Do not infer ROI or accuracy from data-missing samples.

## Current conclusion
Gate: BLOCKED — real fresh D1 account headroom unverified, pending live-health CI, on-device sync not measured. Scanner unchanged. Mobile-only patch remains in production.
