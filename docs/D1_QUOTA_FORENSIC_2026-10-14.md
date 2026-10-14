# D1 quota forensic checkpoint — 2026-10-14

## Scope and guardrails
Base SHA: `1d72fe95245a0ae58f43e6a007c315e2bf6f6635` (PR #5). Production backend reported previously as `6b7accb869cf64598b7ca39d5326d6b4080313e1`; no new production /health confirmation. Cloudflare rollback `60781a4e-70cb-4c02-a036-2528c3048ed5` and frontend rollback `a3ffd320-54ec-4c5b-b7fd-eb6f95edb608` are NOT changed by this branch. Do not deploy or merge merely because these source checks pass.

## Identified D1 write sources
- `worker_notify_v137_quota50000.js`: `fe_notify_live_state` upsert and tombstone; scanner `worker_notify_v130.js` can refresh `lastAt` on failed reads. Payload changes still write; this patch only blocks exactly identical payloads.
- `worker_notify_v131.js`: Push Validation PENDING, retry and result writes, indexed `validation_results`. Legitimate changed attempts/results must still persist.
- `worker.js`: `/api/db/sync` ENTRY_DECISION, ENTRY_OUTCOME, LIVE_SNAPSHOT, fixtures. Fix also blocks ignored/invalid event types from spuriously updating fixtures.
- `worker_v122.js`: `/api/db/sync` QSIG_RESULT and VALIDATION_RESULT plus fixture updates.
- `worker_v123.js`: `/api/db/sync` FIXTURE_CATALOG; prior single event attempts 5 SQL statements (teams x2, fixture_history x1, team_fixture_history x2); same payload replay used to UPDATE them all.
- Smart Follow / Evidence internal snapshots: `worker.js` `dbLiveStmt` / `dbFixtureStmt` via persistence path. Calls enter the same guarded upserts but distinct ID creation may still produce new rows.
- Notification provider retry may change `lastAt`, attempt counts and diagnostics. No scan cadence, retry, provider budget or TOP/EDGE gates modified.

All guards use SQLite `ON CONFLICT ... DO UPDATE ... WHERE` with NULL-safe `IS NOT` comparisons. They preserve inserts, meaningful updates, resolution, push dedup, restart/tombstones and historic rows. They do NOT collapse different event IDs or payloads, delete indexes/history, or alter scan intervals.

**Data semantics caveat**: On exact duplicate catalog or fixture payloads, `last_seen_at` and `updated_at` now represent the most recent *material change* rather than the most recent identical sync attempt. `worker_v124.js` reads these for recency reporting; verify acceptable recency semantics before production rollout.

## Evidence obtained offline
- `node --no-warnings tests/test-d1-quota-idempotency-sql.mjs`: execute actual SQL on indexed SQLite schema; first 5 catalog rows affected, same catalog replay zero changed rows, changed match accepted. Also covers QSIG, Validation, Entry/Outcome, LIVE snapshot, ignored event, LIVE upsert/tombstone, D1 OFF, restart.
- Existing DO/notification tests must remain green (ON/OFF, quota, push crossing, retry, alarm, history); CI adds SQLite test.
- SQLite `changes` is *not* the Cloudflare D1 `meta.rows_written` billing metric. Secondary indexes contribute to Cloudflare write usage. This work makes no measured claim about actual daily Cloudflare savings.

## Cloudflare Analytics evidence — retrieved with read-only GitHub Actions
2026-10-14 read-only preflight at https://github.com/Phuongdien1989/-football-edge-background-watch/actions/runs/38497617875 returned:
- D1 database `football-edge-db` (`0d12a7cc-12a9-4c71-b55b-61dfd2dac4d4`)
- 2026-10-13 UTC dataset: `rowsWritten=113784`, `writeQueries=26319`, `rowsRead=2456865`; D1 Free 100000 daily writes exceeded by 13784 (13.784%).
- 2026-10-14 UTC dataset up to the preflight at ~08:47 Asia/Ho_Chi_Minh: `rowsWritten=24736`, `writeQueries=5037`, `rowsRead=121888`.
- Durable Objects 2026-10-13: `rowsWritten=12152`; 2026-10-14: `rowsWritten=28`. These metrics are separate from D1.
- /health HTTP 200: deployment `6b7accb869cf64598b7ca39d5326d6b4080313e1`; scanner OFF, `next_alarm=null`, 0/720 manual budget used; last scan not current UTC date. LIVE D1 table exists; 36 fixture rows, 0 rows updated in the previous 5 minutes, 0 recent push alert-state updates.
- Rollback version `60781a4e-70cb-4c02-a036-2528c3048ed5` confirmed retrievable.
- GraphQL analytics read PASS; billing usage endpoint HTTP 403 (nonblocking for D1 measurements).
- This establishes that meaningful D1 writes can occur when the main scan is currently stopped, but does not attribute 24,736 rows to phone sync without per-source evidence. Temporal association is not a causality proof.
- Account contains several Workers; none had a listed cron schedule at time of the read-only inventory. Other event-triggered callers cannot yet be excluded.

### Hourly attribution and D1-binding inventory
Read-only Analytics run https://github.com/Phuongdien1989/-football-edge-background-watch/actions/runs/38497893954 showed:
- 2026-10-13 18:00–19:00 UTC (2026-10-14 01:00–02:00 in Vietnam): **29,333 D1 rows written**, 6,035 write queries, while the last retained notification LIVE state was 2026-10-13 20:30 ICT. This makes the paused main notification scan an insufficient explanation for all D1 writes.
- The hour is a calendar UTC grouping from GraphQL, not a complete per-route trace.
Read-only Worker-settings inventory on https://github.com/Phuongdien1989/-football-edge-background-watch/actions/runs/38498088884 identified 11 Workers. Among those, only `football-edge-background-watch` has a D1 binding to database `0d12a7cc-12a9-4c71-b55b-61dfd2dac4d4`. Staging/shadow/raw-capture Workers that have D1 bindings reference **other** database IDs. No listed Worker had a cron schedule. This narrows the relevant deployed Worker to one, but direct Cloudflare D1 API writes, HTTP routes and app-triggered sync remain un-attributed without per-statement instrumentation.

## Required per-route evidence (still missing)
Owner must provide **D1 -> database -> Metrics -> Row Metrics -> 2026-10-13**, visible database name and **Rows written**. Check every D1 database on the **same Cloudflare account**, and Workers / DO usage separately if relevant. A global account ceiling is not attributed by only one database.

A code-level route breakdown requires capturing the D1 binding result `meta.rows_written` per SQL statement or `batch` entry on a *separate authorized controlled pilot*. Do not persist counters back into D1; if instrumented, use non-D1 telemetry, with collection disabled by default and strict privacy of payloads and keys. Compare the sum of all route deltas with account-wide Metrics, including migrations/other Workers.

## Release blocker
Account-wide D1 metrics and production /health are now verified; per-source D1 meta.rows_written remains unknown, and no production Push/LIVE validation or verified 24-hour projected load is available. Therefore **HOLD DEPLOY** and **HOLD PAID UPGRADE**. No frontend changes, no scan pacing/threshold or model changes, no data clearing, no secret rotation.


## PR #6 continuation — 2026-10-14, measured result (NO PRODUCTION DEPLOY)

### UTC correction and exact Analytics query
Timezone: UTC+07:00 (Asia/Ho_Chi_Minh). 2026-10-14 **01:00–02:00 ICT** is **2026-10-13 18:00–19:00 UTC**. The 29,333 `rowsWritten` (6,035 `writeQueries`) in that UTC hour belong to **2026-10-13's UTC daily total of 113,784**, NOT to the 2026-10-14 UTC total of 24,736. The latter comprises UTC 00:00–01:00 13,998 and UTC 01:00–02:00 10,738. Never sum those overlapping calendar buckets. Cloudflare resets Free daily quota at 00:00 UTC (07:00 ICT).
- Dataset: `d1AnalyticsAdaptiveGroups`
- Database: `football-edge-db`, ID `0d12a7cc-12a9-4c71-b55b-61dfd2dac4d4`.
- GraphQL sent via `https://api.cloudflare.com/client/v4/graphql`:

```graphql
query($accountTag: string!, $start: Date, $end: Date) {
  viewer {
    accounts(filter: {accountTag: $accountTag}) {
      d1AnalyticsAdaptiveGroups(limit: 10000, filter: {date_geq: $start, date_leq: $end}) {
        sum { rowsWritten writeQueries rowsRead }
        dimensions { datetimeHour databaseId }
      }
    }
  }
}
```
Filter start=2026-10-13, end=2026-10-14 **UTC**; group by `datetimeHour` and `databaseId`. Account token is passed as a masked GitHub Action secret and never copied into evidence.

### Cloudflare **real D1** staging measurements by operation
- GitHub Actions result PASS: https://github.com/Phuongdien1989/-football-edge-background-watch/actions/runs/38499901068
- Database **staging** `7d503048-9118-4b29-b662-4e1ba6e32167`, **NOT production**.
- Runs exact baseline and patched source statement builders against matched prefixed schemas and indexed D1 test tables, using identical **synthetic** input sequences. Separate schemas, unique run-specific prefixes; no user data, no deletes, no production code deploy.
- Real Cloudflare D1 API response `meta.rows_written`: baseline **165**, patch **98**; saving **67 = 40.606%** **for this synthetic event mix only**. SQLite independent local result: baseline **49 rows changed**, patched **25** (different metric; NOT a D1 billing estimate).
- By route (`meta.rows_written`, old → patched): FIXTURE_CATALOG **68→40**, Evidence/QSIG **13→7**, Validation **7→5**, app ENTRY **28→17**, app LIVE **21→13**, Smart Follow **21→13**, Notification LIVE **5→3**, ignored app event **2→0**.
- First/new data still inserted and changed score/stats/status/settlement updated. Identical ID/payload retries after lost ACK now avoid redundant changed rows; D1 ON/OFF, restart read and tombstone covered.
- Test also returns D1 `meta.changes` and `meta.rows_written` separately by operation; artifact `pr6-staging-d1-meter` includes only aggregate counters. **This is a controlled replay experiment, not route attribution of the actual 113,784 production writes.**
- The one-time staging writer has been disabled in `.github/workflows/d1-pr6-staging-meter.yml` after this proof; no repeating background test writes.

### Data freshness source/dependency audit
1. `worker_v123.js`: `teams.last_seen_at` sorts team history in `/api/db/teams`, and is tie-breaker of analytics ranking `worker_v124.js`; `fixture_history.last_seen_at` is shown as `recent.fixture = MAX(last_seen_at)` in `worker_v124.js`. `team_fixture_history.updated_at` records recent confirmation.
2. `worker.js` and `worker_v122.js`: `fixtures.last_seen_at` reflects most recent write to fixture metadata. ENTRY / outcome `updated_at` are content-change timestamps; query sorting and evidence timelines use `captured_at`, `signal_at`, `resolved_at`.
3. `worker_notify_v137_quota50000.js`: `fe_notify_live_state.updated_at` is last changed persisted JSON; front-end freshness checks rely on `ui.captured_at`/`fresh_at` from provider-backed snapshots. Skipping an identical LIVE payload does not manufacture a new valid snapshot or reset alert dedup.
4. `worker.js` Smart Follow: source `snap.captured_at`, `last_snapshot_at`, `last_detail_at`, fingerprint/signature and periodic heartbeat; snapshot IDs use captured time and are **unique across cycles** even when content repeats.
5. `worker_notify_v130.js` error path: `item.lastAt=Date.now()` can change persisted JSON after provider failures. This is needed for retry priority/pacing and means the Notification LIVE payload may NOT be byte-identical on every retry. Accordingly zero-write on a literal identical object must **not** be extrapolated to every real scan.
6. Source timestamps remain in original payloads; changed `last_seen_at` no longer refreshes on *every* identical upload. **Correction added in this continuation:** bounded 300,000 ms heartbeat to `teams`, `fixture_history`, `team_fixture_history`, `fixtures` in both DB routes even when payload unchanged; each active, confirmed feed may renew recency at least every 5 minutes. No backend scanning interval was changed. Tests: `tests/test-d1-recency-heartbeat.mjs`. If upstream stops, timestamps will age normally; old data must not be made fresh without receiving a feed.

### Quota decision and projections
- Verified 2026-10-13 **113,784** rows written vs **100,000 per UTC day** Free = **13,784 above limit**. A reduction of at least **12.114% of TOTAL account writes** on an otherwise identical workload would only reach the boundary, without safety margin.
- At 10% *total actual* reduction: forecast **102,406/day**, still 2,406 over. At 20%: **91,027/day**, headroom 8,973. At 30%: **79,649/day**, headroom 20,351.
- If (unsupported) all 113,784 daily writes behaved like the synthetic A/B mix (40.606% reduction), illustration **67,581/day**, headroom 32,419; **not evidence of a production forecast**.
- Actual route frequencies and unique-ID vs identical-retry shares have not been captured from production. Existing rows cannot reconstruct discarded replay attempts. Therefore **Free sufficiency after patch remains NOT PROVEN**, retain Draft/NO DEPLOY, NO PAID UPGRADE.
- To measure real production route-level meta, a narrowly gated per-operation accumulator (in-memory, no D1 logging, no raw payloads/tokens) would require deploying instrumentation; **not done** under this authorization. User approval for *any* production code deploy would be required.
- Account-wide metric is available, but not attribution by route; no permission or credential blocker for read-only Analytics. Separate LIVE/PUSH end-to-end production validation of the patched code remains outstanding.

### Scanner OFF — permitted D1 writers
- Pausing notification scanning disables the alarm path; it **does not disable** authenticated `/api/db/sync` invoked by app, independent Smart Follow operations, validation/evidence ingestion, or admin-side D1 queries. These must continue accepting valid events and maintaining history. No new OFF-all-DB-writes assumption introduced.
- Unknown/invalid app sync events must not write fixture metadata; patched.
- Staging A/B replay measures duplicate-row index-aware write savings, but cannot identify which of these paths accounted for the prior production 29,333-row spike.

**RELEASE GATE: HOLD.** CI PASS is necessary but does not certify 24h real load, live provider acceptance or client delivery. Preserve backend production `6b7accb869cf64598b7ca39d5326d6b4080313e1`, rollback `60781a4e-70cb-4c02-a036-2528c3048ed5`, frontend and TOP/EDGE.
