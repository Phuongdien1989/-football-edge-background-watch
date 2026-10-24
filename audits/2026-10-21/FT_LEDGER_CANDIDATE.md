# FT replay ledger candidate — 2026-10-21

Status: staged only; not imported by the production or candidate Worker. No deployment, production table creation, provider requests, or production writes.

Purpose: preserve time-stamped decision inputs and corrected regulation-time outcomes for future replay. This does not introduce a forecasting model, change recommendation thresholds, or validate predictive accuracy.

## Behavior
- Only final FT/AET/PEN fixtures with explicit regulation fulltime scores resolve. Extra-time goals and penalty shootout scores are excluded. Conflicting FT totals remain pending.
- Cancelled/abandoned/awarded/walkover outcomes require explicit settlement rules; no guessed label.
- Fixture identity and receipt/decision timestamps are checked.
- Observation contents are immutable under an observation ID. Exact retries deduplicate. Outcome corrections append and preserve earlier records.
- Adapter is disabled by default; enabling requires an explicit per-record byte limit. Nonfinite values are rejected rather than converted to null.
- Duplicate exact records cost one SELECT; new records use SELECT/INSERT/SELECT. Concurrent duplicate writers may also use three statements. Counts are statements, not Cloudflare billed rows.
- A new receipt timestamp or changed resolution timestamp produces a new outcome record; semantic deduplication across separate observations is not implemented.

## Verification
23 JavaScript checks exercise resolver and adapter with mocked D1; six checks execute SQL on real local SQLite. Neither proves Cloudflare D1 production operation. Existing market/event/integration checks remain in CI.

## Activation requirements
Collector integration, a measured daily storage/read/write budget, bounded sampling and retention rules, and race/retry testing against a disposable D1 environment remain outstanding. No automatic retention deletion is provided. Schema alone does not prevent model leakage: feature extraction must exclude future/post-match fields. Outcome rules must be checked against the actual provider contract before activation.

Candidate Worker behavior remains the previous FT evidence candidate; these files are not copied into its deployable bundle. Rollback for this unactivated stage is reverting this commit; production rollback is unchanged.
