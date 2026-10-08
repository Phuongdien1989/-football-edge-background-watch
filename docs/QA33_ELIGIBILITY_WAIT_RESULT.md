# QA33 — bounded eligibility wait (offline only)

QA32 real pilot: FE-B05A-ELIGIBLE-PILOT-01 / GitHub Run 37722035008.
2 real provider attempts; 0 pinned fixtures; 0 comparable ticks.
Durable stop: NO_ELIGIBLE_FIXTURE_WITHIN_BUDGET. Do not clear/reset stop, change pilot ID, or start a second pilot.
GitHub artifact 11525882520; digest 7524a5d377c6e7e5b31ba1b2ef37b1557e4da8e08171fde27503c6b0ca270158.
Auth gate and staging D1 identity succeeded. Production byte hash before/after matched frozen P2052.
Artifact upload succeeded; local download during QA33 returned HTTP 403, so its full export is not independently audited here.

## Change
Empty/unsuitable discovery returns WAIT_ELIGIBILITY to the runner.
Runner persists diagnostics, renews lease, waits 60 seconds and rereads durable stop before another attempt.
Selection window <=360000ms from durable session start; remaining 240000ms reserved for four ticks.
All requests still pass the atomic durable budget: <=20 selection attempts and <=40 overall.
Discovery endpoint error fails closed immediately; no empty-success interpretation.
Every candidate records explicit eligibility fields and rejection reasons; unsupported live phase is recorded.
Stats zero, events [] and missing market semantics remain unchanged.
Legacy collector callers retain one-shot selection unless opting into waiting.

## Validation
33/33 offline test programs PASS (see QA33_FULL_OFFLINE_TESTS.log).
New regression: delayed fixture arrival yields 4 persisted ACK ticks; empty discovery stops at time reserve;
provider error stops after 2; operator stop during wait prevents any additional request.
Existing HTTP/D1, restart, raw-byte integrity, interleaving budget, phase and reserve boundary tests PASS.
No additional real API requests, remote D1 changes, deploy, production or model changes for QA33.
SHA68F2 baseline retained intact. Model/OLD hashes in QA33_LOCK.json.

## Checkpoint
The existing stopped pilot cannot be resumed by this patch; do not bypass its durable gate.
A later real validation needs explicit scope approval and a live data window. No second pilot is authorized by this offline patch.
Manual workflow remains branch-only, is not installed on main, and will reject the existing stop before provider requests.
Manual dispatch availability from a non-default branch remains a GitHub limitation; do not push main merely to expose it.
