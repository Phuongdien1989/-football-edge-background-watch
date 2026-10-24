# Football Edge FT AI V2 — 3E completion and discovered production D1 Free quota root

Date 2026-10-22 (local Asia/Bangkok). PR #16 Draft `fix/ft-foundation-20261021`. **Do not merge or deploy.**

## Code status: 3E
- Pair-mode FT Observation+Decision -> immutable Outcome ledger linking implemented in `pair-outcome-replay.mjs`, `pending-discovery.mjs`, `outcome-pass.mjs`, `patch-recorder.mjs` and new regression tests.
- Pair rows are verified by content hash and chronology before final fixture API calls; mismatched pairs are quarantined; FT regulation score from `resolveFTOutcome` is linked to original pair, with correction revisions preserved and no accuracy/ROI asserted.
- CI full candidate at run [39752548242](https://github.com/Phuongdien1989/-football-edge-background-watch/actions/runs/39752548242) PASS. Includes paired end-to-end mock Worker outcome path and legacy compatibility.
- No production code, database schema, scanner, HT/HC/TOP/Push, or plan changed.

## Real remote D1 acceptance: BLOCKED (not a code PASS)
- A **single**, locked-down measurement attempted creation of `ft_replay_pairs_v1` in existing isolated database `fe-ft-replay-audit-39699021468`, **not** production. Two schema reads succeeded, then first write failed.
- [Remote run 39752436723](https://github.com/Phuongdien1989/-football-edge-background-watch/actions/runs/39752436723): HTTP 400 code 7500 **account Free D1 daily row write limit exceeded**, 2026-10-22 09:03 UTC. 0 new pair rows, no test DDL created, 0 production writes, no provider calls. Did not retry.
- Cloudflare D1 Free 100,000 rows written/day, reset 00:00 UTC (07:00 Vietnam). The quota is account-wide and enforced since September 1, 2026. Stored data retained.
- Official: https://developers.cloudflare.com/d1/platform/pricing/ and https://developers.cloudflare.com/changelog/post/2026-09-01-d1-free-tier-limit-enforcement/

## Read-only actual account D1 analytics: production is the contributor
- Read-only GraphQL run [39753095391](https://github.com/Phuongdien1989/-football-edge-background-watch/actions/runs/39753095391): 2026-10-22 production DB `FOOTBALL_DB` reported **102,066 rows written**; isolated FT DB **28**; account total **102,094**; 2026-10-21 production **134,294**. Analytics may lag/sample; not a precise billing ledger. GraphQL job made **0 D1 SQL queries/writes**.
- Read-only grouped queries run [39753374035](https://github.com/Phuongdien1989/-football-edge-background-watch/actions/runs/39753374035): on 2026-10-22 production DB:
  - `INSERT entry_decisions`: **11,954 query executions, 95,632 rows written**, 11,954 rows read
  - `INSERT live_snapshots`: **710 queries, 4,970 rows written**
  - `INSERT fixtures`: **13,170 queries, 250 rows written**
- Production DB indexed `entry_decisions` is **~93.7%** of its reported 102,066 daily writes; it is the first optimization target. 95,632 / 11,954 = **8 billed rows written per observed INSERT statement** on this day's grouped data. This is consistent with indexed row/index fan-out; it is NOT evidence that all rows are duplicate data.
- Analysis schema code `schema_v1231.sql` defines six explicit `entry_decisions` secondary indexes + primary key; backend `worker.js` uses `dbEntryStmt()` for `ENTRY_DECISION` events in POST `/api/db/sync`. Actual producer-side sources must be checked; no inference that scanner, UI or device alone caused 11,954 statements.
- Query-group aggregates are sampling/delayed and may differ from billable counters; top groups total < daily DB rows.

## Existing previous fix — DON'T REIMPLEMENT
- Prior project document [docs/D1_SYNC_FIX_REVIEW_2026-10-16.md](../../docs/D1_SYNC_FIX_REVIEW_2026-10-16.md) traces Mobile ENTRY outbox ACK/fingerprint and backend guarded UPSERT. Staging tested same indexed synthetic sequence **119 rows→82** for baseline vs patch, and expanded **237→138** on a different sequence. These are controlled scenarios, not an observed production savings rate.
- [docs/D1_BACKEND_RELEASE_CANDIDATE_ORDERING_2026-10-16.md](../../docs/D1_BACKEND_RELEASE_CANDIDATE_ORDERING_2026-10-16.md) records additional source-revision ordering/correction and rollback preflight. It says **NOT DEPLOYED without explicit approval**. Do NOT assume current runtime contains or lacks changes without fresh read-only Worker version/commit verification.
- Current source `worker.js` in PR baseline contains guarded UPSERT; production deployment SHA is a separate concern. SQL query grouping indicates where write costs accrue but does not identify whether they are new entry IDs, legitimate revisions or replays.

## Actionable next engineering priorities
1. **Protect functioning production**: No new replay writes, no scanner enablement, no plan upgrade, no cleanup, no destructive index change. Daily D1 writes have already exceeded Free; old app components dependent on D1 may receive errors. Keep existing rollback intact.
2. **Read-only confirm live backend + Mobile deploy versions** against PR6 candidate and account GraphQL date-aligned volume. Inspect whether the Mobile outbox ACK/fingerprint fix is actually deployed before changing backend behavior.
3. **Quantify real entry replay and unique ID churn** from bounded aggregate read-only queries or existing app logs, not raw private payload export. Preserve legitimate entries, outcome corrections, anti-future-leakage.
4. **Prefer existing PR6 candidate** for optional source idempotency/ACK fix if it matches live drift and is approved; performance regression and production rollback acceptance are prerequisites. Avoid speculative suppressions based purely on Watch Score.
5. **Re-run isolated pair table measurement only after quota reset and explicit owner approval**, bounded by aggregate D1 budget measured that day. Pair-mode real D1 billable rows, DO invocation and outcome retention remain UNKNOWN; release FAIL.

## End status
- **3E unit/mock integration: PASS**, FT AI model pricing not released.
- **Cloudflare remote D1 write acceptance: FAIL (quota 7500).**
- **Actual D1 heavy write source identified: production entry_decisions via sync, 95,632 rows on 2026-10-22.**
- **Production/HT/HC/FT Legacy/TOP/Push/Mobile/Desktop unchanged.** PR #16 still Draft, no merge/deploy.
