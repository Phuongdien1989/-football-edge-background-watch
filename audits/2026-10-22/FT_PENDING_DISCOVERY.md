# FT pending discovery — trial only, 2026-10-22

## New behavior
The isolated recorder-trial notifyTick now calls a separately gated pending-record pass after its ordinary scan processing. No new alarm or HTTP endpoint. Production has not been deployed, migrated or enabled.
Requires all three flags (replay, outcome, discovery), explicit scanner ON, explicit page/interval/lease bounds, and existing outcome/API/storage budget configuration.

A materialized keyset page reads a bounded number of OBS-prefixed primary keys before checking decision/outcome presence. Completed observations are skipped after pagination so long runs of completed records do not trigger an unbounded search for pending rows.
An added covering index supports the two existence checks. INDEXED BY deliberately fails if the staged index has not been provisioned; there is no fallback full-table scan. Index maintenance adds write/storage cost.
One page query per pass. Empty page wraps the cursor for a later pass. Partial results remain in the ledger and can be revisited on the next sweep. This gives rotation over a finite stable dataset; it does not guarantee latency under growth faster than processing or reset exhausted per-fixture retry limits.

## Persistence and incomplete evidence
A DO transaction reserves a discovery interval/lease. Cursor finalization checks its token; a stale lease cannot overwrite a newer cursor. Failed cursor persistence is reported; the next pass may replay work. Fixture API reservation and outcome checks still apply.
A missing decision is reported and does not prevent retrieval of its final score. No past decision is reconstructed or invented. Invalid observation payloads are flagged and skipped.
Existing OUTCOME kind marks an observation as fulfilled for discovery; full payload integrity is checked by the separate replay audit. Automatic correction polling for completed observations remains outside this pass.

## Verification
Nine discovery cases and six local SQLite checks, plus an additional transformed-Worker notifyTick case. SQLite EXPLAIN shows materialization, primary-key range access and both covering-index lookups. This proves local query shape, not remote billed rows.
The Worker integration follows scan -> observation/decision storage -> discovery -> one final-fixture request -> linked outcome, with mocked provider/D1/DO. Existing tests are retained. No production E2E claim.

## Costs and open activation gates
Each allowed discovery pass adds one D1 page statement, DO reads and normally two DO state writes for reservation/finalization. Each selected due fixture adds the existing API/DO reservation work. Outcomes use the existing D1 write budget. Index writes increase the earlier billed-row estimates; statement counts are not Cloudflare charges.
Outcome API usage still has a separate trial budget and is not included in notify status.apiToday. Aggregate budget accounting MUST be reconciled before activation.
No schema or index has been applied remotely. Need disposable D1/DO validation, total quota measurement, retry/partial-write recovery policy and real provider contract checks before release. Missing decisions remain explicitly incomplete.
