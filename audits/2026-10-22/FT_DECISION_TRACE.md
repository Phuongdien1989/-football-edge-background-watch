# FT decision trace — staged 2026-10-22

Only the isolated recorder-trial Worker is changed. No deploy, remote schema, API calls, scanner toggle or model/threshold/ranking changes.

## Captured at runtime in the trial variant
After a raw observation is successfully stored, an independently stored DECISION record references its ID. Its timestamp is the completed backend scan/evaluation time; input_at is the earlier observation cutoff. Missing statistics produce NOT_EVALUATED, null evaluation, and STATS_UNAVAILABLE rather than inheriting old UI data. Scan exceptions produce ERROR.
Evaluated records preserve FT engine evaluation, normalized market rows, and each participating goal-device's estimate, threshold, gated candidate and crossing_requested flag. Device identifiers/endpoints are excluded; ordinal slots are meaningful only within that decision.
source_hash fingerprints the input candidate v130 Worker plus notify-core.js; the artifact manifest identifies all trial files. It does NOT fingerprint per-device calibration state or the entire dependency tree.
TOP rank, frontend recommendation and push delivery remain explicitly unobserved. Crossing requested is not provider acceptance and not phone receipt. No new fair probability, EV or wagering recommendation is manufactured.

## Outcome/link support
A separate outcome entrypoint resolves an explicitly supplied final fixture and writes through the same persistent budget/pause. It does not query the provider, enumerate pending matches, or run automatically from the Worker. A replay join checks observation/decision/outcome identities and timestamp ordering and returns them separately; it does not settle an unspecified market or claim predictive accuracy.
Corrections append; no earlier outcome is overwritten. Caller must load the actual prior observation before submitting final results. The staged SQL table has no foreign-key enforcement of links; the replay join enforces them in validation, not in every database insert.

## Cost and partial records
Every successful new observation, decision or outcome consumes its own reservation and uses four SQL statements with the existing adapter. Observation plus decision therefore costs eight; a later outcome adds four. This is statement accounting, not billed rows.
If quota expires after the observation, the decision can be absent. Such an observation remains incomplete, not a negative recommendation or training label. The records are not written atomically together.
The staged schema adds DECISION to the allowed kind list. Existing remote tables must not be assumed migrated by CREATE TABLE IF NOT EXISTS. No migration was applied; any future activation must verify exact schema first.

## Tests
13 trace/link cases plus expanded transformed-Worker integration: missing-stats decisions retain no stale score; evaluated FT and per-device estimates match the actual backend snapshot. Earlier schema/SQLite and recorder tests remain in CI. Inputs and remote services are mocked; no production/live-model validation is claimed.

## Still open
Automated final-result retrieval and observation discovery, durable decision/outcome recovery after partial writes, whole-runtime/calibration provenance, live D1 checks, exact TOP/card/Push acceptance evidence and measured Free budget. No production activation in this stage.
