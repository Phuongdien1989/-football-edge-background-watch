# FT Worker recorder trial — 2026-10-22
Not deployed. No remote D1 schema/provisioning, no scanner changes, no new model.

## Actual integration boundary
build-recorder-trial.mjs copies the existing verified candidate into a separate recorder-trial artifact. Only that variant's v130 Worker imports the collector hook. The original candidate bundle and its manifest remain unchanged. Its dependency chain and the status-recovery patch come from the same immutable production baseline verified by build.mjs.

The hook runs immediately after the existing four provider responses, before the stats-missing branch and stale-snapshot check. It records 2H scans regardless of recommendation readiness. It uses existing payloads; no additional provider call. Fixture receipt is captured after LIVE catalog resolves, detail receipts at response/error time. Unknown provider source timestamps stay null. ERROR/INVALID are distinct from EMPTY; failure payloads remain null.

These are scan input observations, not a complete decision ledger: model_version is null and exact card/TOP/Push decisions are not captured. Final-outcome retrieval and linkage remain outstanding. 1H/LIVE/terminal phases are not recorded by this hook.

## Explicit trial-only configuration
FT_REPLAY_TRIAL_ENABLED must be the string true. Requires dedicated FT_REPLAY_DB binding, nonempty FT_REPLAY_TRIAL_EPOCH and explicit positive FT_REPLAY_TRIAL_MAX_RECORD_BYTES. No production configuration is added. Budget/table provisioning is manual and not performed here.

## Persistent pause
A D1 denial, D1 failure or ledger failure sets a pause in the existing watcher DO storage under a separate key. Subsequent calls in the same instance stop without storage access; after restart one DO read restores pause without another D1 request. An explicit epoch change allows a recheck, but does not refill the D1 budget.
This pause is scoped to one watcher DO; the database reservation remains shared across instances. There is no assertion that all possible watcher DOs share the pause.
If pause reads fail, no D1 request is made. If pause writes fail, this is reported with pause_persisted:false; only in-memory suppression is assured, so a later restart can query again. No false persistence claim.
Each newly started enabled Worker needs a DO read; a new pause needs a DO write. Persistent budget costs from the previous stage remain. This is not a certification of daily Free-plan usage.

## Verification
Eight hook cases exercise mocked D1/DO: disabled, out-of-scope, missing/error/high-price data, queued requests, restart, failure, explicit epoch change and configuration.
Four integration cases execute the transformed Worker with the real FT engine and mocked provider/storage: disabled path preserves calls/logical puts, empty stats captured, provider errors retain receipts, and pause survives a new Worker while scanning continues. These are not production E2E or real push delivery proof.
Existing 12 SQLite persistent-budget cases and earlier tests remain in CI.

## Remaining
Remote disposable-D1 validation, end-to-end outcome linking, exact decision snapshot, aggregate billed-row/DO-write measurement, independent model validation and release review. No production enablement until these are reviewed.
Rollback: discard/revert this trial-only build; existing production unchanged by this work.
