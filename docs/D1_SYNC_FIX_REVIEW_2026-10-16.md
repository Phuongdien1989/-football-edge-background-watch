# Football Edge — D1 SYNC ENTRY/metadata fix, OFFLINE AND STAGING ONLY

**Date:** 2026-10-16 (UTC), **approval scope:** develop and measure; NO production deployment.

## Immutable baselines

- Backend **running production at authorization:** commit `d73d4b19a069b0b2aed7e2687f27f1820f50e3d1`, Cloudflare Worker version `02d56762-ba08-4a8d-8654-bc9d522fc29a`.
- Direct backend rollback already retained: `5f33a4b1-a299-4195-8a68-4646396a9214`.
- Mobile production HTML SHA-256: `aa4f0f6318cd52c14ff62b195c5ea04c5267107455924da44c9aa78169fe7f28`; app unchanged, no deploy.
- PR #6 original `79cd4ddfa4191fa5a6e620683947d77e6ecbf31c` and PR #7 production instrumentation `d73d4b19a069b0b2aed7e2687f27f1820f50e3d1` untouched/unmerged.

## Source tracing

- Current Mobile frontend `index.html`: `feDbQueueEntryDecision` creates `ENTRY:<id>` events with a fresh `created_at` and calls `feDbOutboxPut` **without a fingerprint or an ACKed sync_state key**. Evidence/validation uses `feDbQueueEvidence` with fingerprints; ENTRY did not.
- Outbox: IndexedDB `FOOTBALL_EDGE_DB_OUTBOX_V1/events`, with `queue_revision` per replacement; `feDbSyncOutbox` POST `/api/db/sync`; previous ACK code only checked `res.ok`, then separately persisted sync_state and deleted outbox. Lost HTTP ACK can retransmit the same id and payload.
- `worker_v123.js` and `worker_v122.js` forward to `worker.js`, which previously unconditionally UPSERTed `entry_decisions`, `entry_outcomes` and `fixtures` even for repeated same event.
- **No `FIXTURE_CATALOG` event producer appears in the archived deployed Mobile frontend**; that event type appears in backend receiver only. Do not claim this producer was fixed or observed.
- Measured Oct15 Workers Logs: `SYNC_ENTRY` 60,246 observed rows written; `SYNC_FIXTURE_METADATA_UNCLASSIFIED` 16,874. The log sample is **incomplete/truncated**; cannot prove how many event IDs are duplicates. Production `entry_decisions` contains 22,480 unique rows, with 8,889 last-updated on Oct15. Do not label all incoming write load as duplication.

## Actual changes on this independent branch

- `worker.js`: selective PR #6 guarded UPSERT in `fixtures`, `entry_decisions`, `entry_outcomes`, plus skip fixture write for invalid/ignored event.
- `worker_v122.js`: guarded fixture metadata write.
- `worker_v123.js`: guarded `teams`, `fixture_history`, `team_fixture_history` UPSERT.
- Explicitly **omit PR #6's 5-minute receipt heartbeat** for these metadata UPSERTs. Repeated stale payloads must not refresh source freshness as a side effect. Changed provider content still writes.
- `mobile-outbox-candidate/build_mobile_candidate.mjs`: hash-locked, offline HTML transformation only. Adds full stable canonical ENTRY payload fingerprint, atomic IndexedDB ACK + outbox deletion (retains newer queue revision on late ACK), enforces explicit whole-batch `accepted` and `ignored=0`. It never deploys; production Mobile/Desktop remains untouched.

## Independent staging evidence (same input, REAL Cloudflare D1 rows_written)

[Staging A/B indexed from **actual production** SQLite schema](https://github.com/Phuongdien1989/-football-edge-background-watch/actions/runs/38840273757).

- Dedicated isolated test tables in **STAGING** D1 `7d503048-9118-4b29-b662-4e1ba6e32167`, generated from actual production `sqlite_master` DDL (11 tables / 16 indexes checked).
- Production database `0d12a7cc-12a9-4c71-b55b-61dfd2dac4d4` was **read-only** for schema/index and aggregates, not modified.
- Same synthetic event sequence: original production source **119** D1 rows written; proposed patch **82**; **37 fewer (31.09%)**. Not a production savings forecast.
- By selected operations: catalog first `7→7`, ACK-lost retry `5→0`, old replay after one hour `5→0` (no provider freshness refresh), actual score change `5→3`; ENTRY first `10→8`, ACK-lost retry `7→0`, valid RESOLVED change `11→9`; ignored event `2→0`.
- Breakdown under SAME indexed synthetic load: CATALOG 22→10; ENTRY 28→17; app LIVE 21→17; Smart Follow 21→17; Evidence 13→9; Validation 7→7; Notification 5→5; invalid event 2→0. These are grouped *test operations* rather than inferred percentages of real production routes.
- Other unaffected or partly affected groups continue to write and are explicitly accounted for in the workflow artifact.
- ENTRY / outcome preserved: `RESOLVED`, `HIT`, `resolved_at=4000`, `captured_at=3000`, legitimate minute/score **0** all verified under both variants.
- Extrapolation caveat: true production write costs depend on volume of genuinely new ENTRY records, other applications sharing D1 quota, and log collection coverage.

## Mobile candidate tests

[Mobile outbox candidate QA](https://github.com/Phuongdien1989/-football-edge-background-watch/actions/runs/38839721408).

- Verify downloaded public Mobile frontend against exact pinned SHA-256, create offline candidate.
- Uses actual IndexedDB semantics in test: first event, pending duplicate, lost ACK, new RESOLVED outcome, actual correction, 0 vs null, old ACK does not delete newer revision, ACK and removal same transaction, incomplete server ACK refuses to clear outbox.
- **PASS.** Candidate generated on CI, not used on production or sent to phone; artifact in workflow run contains `candidate_mobile.html`.

## Remaining limitations / release gate

- This branch remains a candidate; real on-phone network/Push, source-level duplicate rate, and a representative full UTC production day after deploying are **NOT VERIFIED**.
- No production load, scanner ON, D1 data deletion/reset or account plan upgrade.
- SQL `n(null)` coercion elsewhere in inherited backend and out-of-order genuinely different stale payloads require separate compatibility review; the tested change addresses *identical* replay and preserves the tested 0 values, not every historic data-quality bug.
- PR #6 remains a separate draft; nothing merged.
- **Do not deploy until owner approves separately** after reviewing above actual test results and rollback. Rollback original backend `d73d4b...` / Worker `02d56762...`; if Mobile candidate were ever deployed later, revert exact HTML to pinned `aa4f...` SHA.

## Next decision

Review this branch and A/B details. In later *separate* release approval, require no drift in live phone/backend versions, rollback available, proof on natural workload, and validation that Push and TOP/EDGE did not regress. Do not use a staging percentage as a production KPI.
