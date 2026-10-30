# Football Edge FT AI V2 — Step 3E checkpoint (2026-10-22)

## Status
- **PAIR→OUTCOME model and transformed Worker integration: PASS in unit/mock/local pipeline.**
- **Cloudflare isolated remote pair write measurement: FAIL — real D1 account Free daily write quota exhausted** at 2026-10-22 09:03 UTC (16:03 Vietnam).
- **Production: NOT TOUCHED; release gate BLOCKED.** PR #16 remains Draft. No scanner enablement, Worker deploy, schema migration on production, account plan change, provider calls, HT/HC/FT Legacy/TOP/Push changes.
- Baseline carried forward from 3D: commit `eca5c643952ddaf533d858878d1e6b45c8488abb`.

## 3E code implemented
- `pair-outcome-replay.mjs`: read-only query over `ft_replay_pairs_v1` using indexed EXISTS for old append-only `ft_replay_records_v1` OUTCOME rows. Strong pair snapshot validation: immutable content hash, ID, fixture, decision/input chronology, source receipts and prevention of terminal score leakage.
- `pending-discovery.mjs`: pair schema switches to new pair query, skips invalid/forged pairs without calling football provider, discovers eligible unresolved fixtures; old legacy path stays intact.
- `outcome-pass.mjs`: direct pair-mode entrypoint must come through `PAIR_DISCOVERY_VALIDATED` source option (provenance marker internal to staged runtime); provider results still resolved by the existing FULL_MATCH_REGULATION resolver and stored in old append-only OUTCOME ledger. Shared provider API budget, retry/lease limits and sidecar SQL budget retained.
- `patch-recorder.mjs`: paired scan admission with 5 SQL headroom reserved when outcome discovery enabled, not zero admission.
- `auditFTPairOutcomeRows()`: produces linked, missing, invalid, conflicting, corrected-outcome reporting; never claims ROI, probability calibration, market value or historic results that are not backed by records.
- `test-pair-outcome-replay.mjs`: 12 integrity/lineage checks; extended `test-pending-discovery.mjs`, `test-outcome-pass.mjs` and `test-recorder-integration.mjs`: legacy regression and paired scan→decision→outcome complete cycle checks.

## Passing evidence
- Candidate CI full suite **PASS** at run [39752548242](https://github.com/Phuongdien1989/-football-edge-background-watch/actions/runs/39752548242), commit `1c6c3cb28953925df136c2957d3b56b098cb5de9`.
- CI logs explicitly show `PASS pair ledger discovery fetches only verified source rows and appends outcome`, `PASS corrupt pair is quarantined without outcome API call`, `PASS atomic pair plus outcome discovery joins result without a second forecast`.
- Test SQL cost for single paired OBS+DEC = **3 statements** in mocked D1 (budget reservation, INSERT, verification); paired outcome requires additional statements. **NOT real remote D1 billable cost**.

## Exact remote measurement blocker — no new pair row written
One-shot isolated remote run [39752436723](https://github.com/Phuongdien1989/-football-edge-background-watch/actions/runs/39752436723), commit `33511f6023be6798b7b1659bebb8886f764a2e1d`:
- Hard-coded isolated D1 identity: `fe-ft-replay-audit-39699021468`, UUID `e82758f2-e533-44a6-b42d-4821d120e082`; explicit exclusion of known production DB UUID.
- Test account verified; **two read-only SQL schema preflight queries completed** (`rows_read=5` each; `rows_written=0`).
- The very first write-like SQL, `CREATE TABLE ft_replay_pairs_v1` in isolated DB, FAILED: HTTP **400**, Cloudflare code **7500**:
  `Your account has exceeded D1's free tier daily row write limit. Upgrade to a paid plan or wait until tomorrow (midnight UTC) to continue.`
- Report: `status=FAIL`, `production_writes=0`, `provider_calls=0`, `deployments=0`, `scanner_changes=0`. Pair table was not created; no pair or outcome test row was inserted in the failed run. The existing isolated DB/data was retained. Artifact is attached to the failing workflow run.
- **No rerun** after limit exceeded. The one-shot job is gated by commit marker, run attempt and exact database identity.
- On Cloudflare Free, limit is **100,000 D1 rows written/day across the account**; enforcement is active since September 1, 2026, and resets midnight UTC (07:00 Asia/Bangkok). This error is direct account-level evidence that writes are blocked **at the test time**, but does not establish which production component consumed quota or whether it is currently serving valid results. Stored data is preserved. 
- Official docs: https://developers.cloudflare.com/d1/platform/pricing/ and https://developers.cloudflare.com/changelog/post/2026-09-01-d1-free-tier-limit-enforcement/

## Current release gates
1. **FAIL: isolated real D1 paired table creation and measured rows read/written**. The account is currently quota-limited; do not attempt more writes until a future owner-approved bounded trial after quota reset.
2. **UNKNOWN: production/shared-account causes of D1 row usage.** Use Cloudflare D1 Metrics → Row Metrics per database (or read-only GraphQL analytics) to locate heavy table/index and scan cadence; do not infer cause from this test. Avoid plan upgrades solely to pass a test.
3. **UNKNOWN: aggregate real Worker/DO D1 queries/rows/CPU per invocation**, existing app + replay pair + outcome. Sidecar-only cap 24 is not proof of 50 Free Worker D1 queries.
4. **UNKNOWN: durable multi-tick paired observation/outcome coverage and provider timestamp freshness on real fixtures**.
5. **NOT PRESENT: empirical FT AI Tài/Xỉu calibrated probability, fair price, edge and ROI**; no claim of profitable recommendations.

## Hold / next acceptance
- Leave production and scanner unchanged, PR #16 Draft, no deployment.
- Preserve remote failure artifact; do not automatically retry or trigger account writes from CI.
- Next authorized verification should FIRST inspect read-only account row metrics, THEN (after quota genuinely resets and owner accepts small write cost) attempt a tightly bounded isolated D1 pair write; audit total Worker D1/DO load before enabling live data collection.
- Retain the historical FT old/FT AI V2 model comparison plan; 3E code is ready for real validation but not released.
