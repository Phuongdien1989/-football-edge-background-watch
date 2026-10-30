# FT outcome pass and completeness audit — staged 2026-10-22

No deployment, production API requests, schema writes, scanner changes or model changes.

## Trial Worker integration
The isolated recorder-trial Worker exposes an internal ftReplayOutcomePass(observations) method. This method is NOT called by notifyTick, alarm or an HTTP route. It requires an explicit bounded array of prior observation records. Pending-record discovery/scheduling remains unimplemented.
Both FT_OUTCOME_TRIAL_ENABLED and FT_REPLAY_TRIAL_ENABLED must be true strings, and scanner control must explicitly report enabled. Missing scanner control denies execution. The method does not toggle scanning.

Explicit positive limits are required for MAX_OBSERVATIONS, MAX_FIXTURES, MAX_WRITES, RETRY_MS and MAX_ATTEMPTS under the FT_OUTCOME_TRIAL_ prefix. A separately provisioned DO API-budget window under ft:outcome:api-budget:v1 is mandatory; no auto-provision or renewal occurs.

Observations are grouped by fixture. One strict existing Worker API call to /fixtures with id serves all supplied observations for that fixture. Empty/wrong/multiple results stay unconfirmed. Ongoing, cancelled or ambiguous regulation scores are handled by the existing resolver. Final records use the existing shared D1 reservation/pause and preserve revisions.

Before each provider call a DO transaction reserves one API attempt and next-check time. Fetch failures consume that attempt. A new Worker instance sharing the same DO respects retry delay. Multiple distinct DOs do not share this API budget. It is separate from notify's API budget; aggregate provider allowance must be reviewed before activation. MAX_ATTEMPTS is persistent per fixture until an explicit lifecycle policy is implemented.
A blocked storage stage can leave some observations without outcomes. No automatic resume or fairness guarantee; caller must select deferred work.

## Cost
One provider request per selected due fixture, not per observation.
Each successful reservation performs two DO puts (budget and fixture retry), plus its reads. These are logical operations, not billed units.
Each resolved new outcome uses four SQL statements via the existing adapter. Two observations of one fixture therefore use one API request and eight SQL statements. Nonfinal results use no D1 outcome writes.
This mechanism increases API/DO/D1 usage when enabled. No Free compliance certification.

## Coverage audit
Offline audit of supplied/exported rows only: LINKED, missing decision/outcome, orphan records, conflicting observations/decisions/outcomes, and invalid links are separated. Same-receipt conflicting scores are not arbitrarily selected. Later corrections are used while reporting revision count. NOT_EVALUATED decisions remain visible.
LINKED means trace completeness only. Accuracy, ROI and market settlement are not inferred. This audit is not a census of the production database.

## Evidence
16 outcome/audit cases plus the actual transformed trial Worker entrypoint integration are exercised in CI. Provider/D1/DO are mocked; serialized transaction mocks do not prove Cloudflare transaction behavior.
Existing tests remain required. No live fixture or real phone-delivery proof.

## Next requirements
Bounded indexed discovery of pending observations, fair scheduling and backfill of partial records, provider-response contract checks on real samples, combined API quota and billed-write measurement, disposable remote D1/DO validation. Outcome correction polling policy and retry-state lifecycle remain explicit open items.
