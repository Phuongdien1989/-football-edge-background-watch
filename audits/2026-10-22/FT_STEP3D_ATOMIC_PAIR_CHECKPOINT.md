# Football Edge FT AI V2 — Step 3D: atomic-pair trial and capture reconciliation

Date: 2026-10-22. Branch: `fix/ft-foundation-20261021`, PR #16 **OPEN/DRAFT**. **NOT DEPLOYED**.

## Exact purpose
Eliminate half-written Observation/Decision *within the newly staged pair-ledger format* and distinguish selected fixtures from successful recorder acknowledgments. Do NOT alter FT Watch/Goal Radar, HT, HC, cards, TOP, Push, original recorder or scanner when pair flag is OFF.

## Code implemented
- `ft-pair-collector.mjs`, `ft-pair-ledger.sql`: one append-only `ft_replay_pairs_v1` row with canonical observation JSON, decision JSON and content hash, linked by unique observation ID. The SQL INSERT is atomic at the single-row level; budget reservation remains a **separate** SQL command, conservatively unrefunded on crash/error.
- `worker-recorder.mjs`: if **both** existing recorder opt-in `FT_REPLAY_TRIAL_ENABLED` and **new** `FT_REPLAY_PAIR_TRIAL_ENABLED` equal `true`, stage the snapshot in memory and persist only after Decision is built. Default code path unchanged. All pending snapshots are ephemeral, not a durable queue and not retrospectively reconstructable.
- `decision-trace.mjs`: opt-in paired persist instead of separate legacy Decision record.
- `patch-recorder.mjs`: selection planner accounts for modeled **three replay-sidecar SQL attempts per new pair** instead of the previously measured eight for two separate records. Pair mode with old outcome discovery enabled is explicitly not admitted. Trial DO manifest retains up to 16 plans with a best-effort post-tick `attempts` summary (capture status, decision status, recorder-confirmed flag). The status is *not* an independently verified D1 receipt.
- `outcome-pass.mjs` and `pending-discovery.mjs` fail closed with `PAIR_OUTCOME_NOT_WIRED` while paired mode is enabled. Paired results cannot yet be sent through the old ledger outcome resolver. This is intentional to prevent incomplete or mislabeled matches.
- `replay-validation-report.mjs` reports selection success, failure and unknown **by trial hook only**, preserving `accuracy=null,roi=null` and `NOT_INDEPENDENTLY_VERIFIED`.

## Evidence and tests
- 12 isolated unit cases verify identities, timestamps, canonical hashes, budget reservation, exact retry, conflicts, and simulated insert/read failure.
- 6 local SQLite schema cases verify a pair is a single row, replay idempotency, chronological constraints and no half-pair on failed insert.
- Trial Worker integration checks that default mode preserves legacy provider/Notify behavior; opt-in paired record is one confirmed pair; admission is deferred when replay SQL cap cannot fit a full pair; final manifest distinguishes confirmed from deferred.
- Outcome/discovery guards have tests proving zero unsupported API/database access.
- Report additional checks ensure hook-confirmed is not asserted as independent D1 success; missing hook results are UNKNOWN rather than failed.
- Reference CI: https://github.com/Phuongdien1989/-football-edge-background-watch/actions/runs/39748274978 (earlier integrated checkpoint PASS); later validation CI at current branch head must also pass. Intermediate test-only fixes briefly failed CI; do not cite these as passing.

## Cost: measured vs modeled
- Prior isolated **remote Cloudflare D1 REST** measurement of separate OBSERVATION + DECISION: **8 SQL statements and 8 rows written** per pair in that isolated table/index arrangement:
  https://github.com/Phuongdien1989/-football-edge-background-watch/actions/runs/39699252168
- Proposed new *one-row* PAIR path: **3 attempted statements per successful unique pair in mocks**: 1 budget reservation, 1 INSERT, 1 verification SELECT. Duplicate/conflict still reserve conservatively.
- There is **NO remote Cloudflare D1/DO measurement** of this new schema. Its billable read/write rows, index overhead, total Worker query count, runtime and quotas cannot be inferred from this mock SQL count.
- On simulated 24-query sidecar budget, theoretical ceiling increases from 3 separate pairs to 8 pair-ledger rows if no other sidecar work; this is a concurrency/projection bound, NOT production throughput.

## Unresolved release blockers (must stay BLOCKED)
1. **No remote D1/Worker/DO acceptance of paired schema**; indexes/read/write rows/CPU/rollover under real concurrency unknown.
2. **No aggregate per-invocation D1 meter** across inherited Worker + sidecar and other account daily workloads. Preserving Cloudflare Free remains unverified.
3. **No paired outcome discovery/reconciliation**. Paired mode deliberately disables old outcome worker; new pair schema is not integrated into completed FT replay ledger.
4. **No end-to-end durable success reconciliation** from D1 data readback across scan sessions. DO manifest statuses are best-effort and not a substitute for committed D1 audit.
5. **No historic LIVE model calibration, ROI, fair odds or actual Tài/Xỉu value validation.** No API/provider requests or production scanner/deploy were performed as part of 3D.

## Release recommendation
Keep `FT_REPLAY_PAIR_TRIAL_ENABLED`, `FT_REPLAY_TRIAL_ENABLED`, `FT_OUTCOME_TRIAL_ENABLED`, and `FT_OUTCOME_DISCOVERY_ENABLED` OFF in production. No production schema/index migration or deploy; do not merge PR #16 yet.

Next stage: isolated remote D1 measurement of pair table; end-to-end pair→outcome replay discovery with strict schema separation and budget proof; account-wide D1 meter, followed by explicit owner approval before any production opt-in.
