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

## Required Cloudflare evidence (still missing)
Owner must provide **D1 -> database -> Metrics -> Row Metrics -> 2026-10-13**, visible database name and **Rows written**. Check every D1 database on the **same Cloudflare account**, and Workers / DO usage separately if relevant. A global account ceiling is not attributed by only one database.

A code-level route breakdown requires capturing the D1 binding result `meta.rows_written` per SQL statement or `batch` entry on a *separate authorized controlled pilot*. Do not persist counters back into D1; if instrumented, use non-D1 telemetry, with collection disabled by default and strict privacy of payloads and keys. Compare the sum of all route deltas with account-wide Metrics, including migrations/other Workers.

## Release blocker
No read access to Cloudflare account Metrics, no fresh production /health, no production Push/LIVE validation, no actual D1 meta.rows_written capture, and no verified account-wide 24-hour projected load. Therefore **HOLD DEPLOY** and **HOLD PAID UPGRADE**. No frontend changes, no scan pacing/threshold or model changes, no data clearing, no secret rotation.
