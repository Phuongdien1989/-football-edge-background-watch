# FOOTBALL EDGE — BACKEND-ONLY D1 RELEASE CANDIDATE / APPROVAL GATE
Date: 2026-10-16 UTC. **DO NOT DEPLOY without separate user approval.**

## Base and release boundary
- Branch: `fix/d1-sync-entry-fixture-idempotent-20261016` built from **exact metered production** `d73d4b19a069b0b2aed7e2687f27f1820f50e3d1`.
- ACTIVE production backend confirmed **READ ONLY**: `02d56762-ba08-4a8d-8654-bc9d522fc29a` at 100%, deploy commit `d73d4b19a069b0b2aed7e2687f27f1820f50e3d1`.
- This original ACTIVE version is the **immediate rollback target** for any future candidate deploy. Older rollback remains present: `5f33a4b1-a299-4195-8a68-4646396a9214`.
- Mobile frontend Worker `shiny-silence-d892` ACTIVE remains `03c1d55d-358a-448b-96f3-f356704831df`. Desktop B2 and Mobile outbox **must NOT be deployed as part of this backend release**.
- Production D1 binding stays `FOOTBALL_DB` / `0d12a7cc-12a9-4c71-b55b-61dfd2dac4d4`; no schema migration. PR #7 meter and entrypoint `worker_notify_v138_peak_window.js` unchanged. No additional polling or D1 logging writes.
- PR #6 / PR #7 heads unchanged at `79cd4ddfa4191fa5a6e620683947d77e6ecbf31c` and `d73d4b19a069b0b2aed7e2687f27f1820f50e3d1` (both unmerged). No changes to engine, TOP/EDGE, validation policy, scan rhythm, push, thresholds or scanner ON/OFF control.
- Backend production **scanner OFF**, `next_alarm=null`, cron count 0 in read-only preflight.

## Additional defect actually reproduced on indexed Cloudflare D1 staging
- Earlier candidate `c82421c9d9777b4bc197aa0c964d58bbae0de393` handled **identical retries** but did **not** protect altered, out-of-order payloads.
- A fixture `1H` source revision 1 arriving after `FT` revision 2 rewrote `status,minute,score` despite terminal flag; originally **FAIL**.
- A prior resolved HIT event arriving after correction MISS rewrote ENTRY and outcome; previously **FAIL**.
- Older OPEN arriving after RESOLVED could reopen entry without compensating associated outcome; previously **FAIL**.
- This motivated follow-on changes in `worker.js`, `worker_v122.js` and `worker_v123.js`.

## Implemented ordering rules and correction handling
- For `entry_decisions`, `entry_outcomes`, `fixture_history` and `team_fixture_history`, **optional numeric `source_revision` inside existing `payload_json`** wins: incoming revision must be higher than the stored revision when a stored revision exists. Missing incoming revision cannot downgrade a record already carrying a source revision.
- **No** Worker receipt-time ordering, no server-created freshness, no D1 schema changes or extra D1 SELECTs.
- Legacy unversioned safeguards: `entry_decisions` cannot go from RESOLVED back to OPEN/PENDING (would invalidate stored outcomes); `fixture_history` and `team_fixture_history` cannot regress terminal state to nonterminal from an unversioned payload; core `fixtures` receives the same terminal status protection.
- Legitimate outcome correction in RESOLVED state is allowed even if `resolved_at` is unchanged; source-revisioned corrected outcome/HIT-MISS dominates old retry. Legitimate **newer** revision may correct fixture minute/status/score including reopening a previously terminal fixture (its `terminal` projection changes consistently).
- A request to reopen RESOLVED ENTRY is blocked even with newer revision because no supported outcome-compensation protocol exists. This is a deliberate integrity stop, NOT full lifecycle reopening support.
- Already-persisted legitimate ENTRY, settled outcome, fixture history, scores of 0 and index layout are preserved.

## Indexed staging proof, SAME expanded synthetic traffic
- [Out-of-order + correction regression PASS](https://github.com/Phuongdien1989/-football-edge-background-watch/actions/runs/38842676351).
- Original metered production-source SQL: **237 D1 meta.rows_written**. Candidate SQL: **138**. Savings **99 rows (41.77%)** **only for this expanded synthetic staging sequence**. Do not compare this percentage with the original 119→82 test as if it were the same workload.
- Exactly **11 tables and 16 indexes** recreated from production `sqlite_master` into isolated staging tables with verified parity; no production DB writes.
- Confirmed scenarios: old revision-1 fixture after final revision-2 ignored; version-3 fixture correction legitimately reopens state and preserves 0 score; previous version-2 retry cannot overwrite version-3; unversioned terminal FT not downgraded by old 1H; corrected resolved ENTRY/outcome revision-2 MISS/0 remains intact despite old revision-1 HIT/OPEN replay; legacy resolved ENTRY not reopened; legacy RESOLVED correction HIT→MISS with unchanged resolved_at accepted; after correction, ENTRY and OUTCOME consistent.
- All existing earlier tests on unchanged Mobile candidate [PASS](https://github.com/Phuongdien1989/-football-edge-background-watch/actions/runs/38839721408); not rerun because the Mobile candidate and its tests did not change.

## Strict caveat — ambiguity of old unversioned clients
**Important:** The production Mobile frontend does **not** send `source_revision`. If it sends two different RESOLVED outcomes for the same ID, or two different **nonterminal** fixture metadata versions, and an old payload arrives last, backend cannot always determine which was a legitimate correction with the information currently provided. Treat this as **UNRESOLVED**, never as PASS. A release of backend-only protection removes the *proven* terminal and versioned regressions, but does not give a mathematical guarantee for all unversioned out-of-order corrections. Do not invent a receiver-time ordering rule or silently drop an ambiguous legitimate correction.

The strict absence of `source_revision` also means source-versioned scenarios in staging are forward-compatibility contract tests, not proof that today's phone emits source revisions. Old-client compatibility is tested for identical retry, protected RESOLVED/terminal transitions and unversioned RESOLVED corrections. Mobile production remains entirely unchanged.

## Backend-only release preflight — PASS, NO DEPLOY
[Read-only production and dry-run bundle gate](https://github.com/Phuongdien1989/-football-edge-background-watch/actions/runs/38842789009): actual Worker version and commit, Mobile version, D1 binding, scanner OFF, no cron, original and older rollback versions, PR6/7 heads; source bundle and `wrangler deploy --dry-run` PASS.
- No GitHub Actions release flow can deploy from this branch automatically.
- Only `worker.js`, `worker_v122.js`, `worker_v123.js` are existing backend runtime files altered; the change-only test scripts, read-only gates and docs are separate. `wrangler.toml`, frontend, `worker_notify_v138_peak_window.js`, `d1-production-meter.mjs` remain source-identical to original production.

## Proposed single-approval release protocol (NOT YET AUTHORIZED)
1. Receive explicit owner approval for **BACKEND ONLY** after accepting the caveat about **unversioned differing stale payloads**. If this caveat is unacceptable, **HOLD** release until a source ordering contract can be introduced by a separately approved Mobile or event producer change.
2. Re-read Cloudflare production deployment and `/health` immediately before release: exact original version `02d56762-ba08-4a8d-8654-bc9d522fc29a` and commit `d73d4b...`; verify scanner OFF, `next_alarm=null`, D1 binding, and both rollback versions. Abort on drift; never turn scanner ON.
3. Build/deploy the **approved commit only** using the unchanged production `wrangler.toml` and entrypoint `worker_notify_v138_peak_window.js`, keeping metering. Do not merge PR #6/#7 or upload offline Mobile candidate. Capture deployed Worker version ID, backend commit and success code; do not claim success merely for Wrangler exit code.
4. After deployment, inspect active Worker version at 100%, `/health` deploy commit, D1 schema, scanner state, Worker Logs receipt and PR #7 meter operation; do not generate artificial D1 write traffic and do not run Push test. Preserve OFF and `next_alarm=null`.
5. On health/version/binding/scan or telemetry failure, **redeploy original pre-release Worker version** `02d56762-ba08-4a8d-8654-bc9d522fc29a` at 100% via Cloudflare version deployment API, and independently verify the original backend commit and health restored. Do not treat a rollback request as success until verified. Mobile Worker remains unchanged either way.
6. Once backend-only release is verified, **ask owner to manually enable scanning**, not earlier. Compare PR #7 route-level `meta.rows_written` with account D1 Analytics over **aligned UTC windows** of real usage, identify observed/unobserved routes, and validate Push, TOP/EDGE, history, outcome; if indicators regress or account approaches D1 Free limits, turn off via existing owner control and rollback after safety assessment. No 24h extrapolation from a short window.
7. No plan upgrade, database deletion, quota reset, forced startup, Mobile/Desktop modifications or new polling paths.

## Status
**Candidate backend developed and staging ordering/integrity tested. Pre-release READ ONLY gate PASS. User approval still required. Production deployment NOT attempted.**
