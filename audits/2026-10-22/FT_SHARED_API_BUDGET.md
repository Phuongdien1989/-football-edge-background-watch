# Shared trial API budget and cost evidence — 2026-10-22

No production deploy, API calls, migrations, flag changes or scanner toggle.

## Correction
In the isolated recorder-trial Worker, enabling FT_OUTCOME_TRIAL_ENABLED routes v130 scan API reservations through the existing notify:budget key using a DO transaction. Outcome reservations consume the same key within their own retry/sub-budget transaction.
Both use NOTIFY_DAILY_BUDGET (same default 5000) and the existing UTC day boundary. No threshold or scan cadence changes.
The per-outcome window remains an additional cap, not extra allowance above the shared total. API errors/crashes after reservation consume the attempt. The end of the scan reloads persisted usage for status.apiToday; it never overwrites transactional usage with an older local count.
Disabled outcome mode preserves the original scan-budget behavior.

Scope is these paths in one watcher DO. Other Worker objects, parent-class provider paths, frontend calls or direct this.api uses are NOT proven covered by this total. This is not the provider-account-wide quota.

## Verification
Eight shared-budget checks: existing count preservation, concurrent last-slot contention, restart, UTC rollover, clock rollback, malformed count, crash reservation and missing transaction.
Expanded transformed-Worker test: 5 scan calls + 1 final-result call produce notify:budget.used=6 and status.apiToday=6. Pipeline retains all prior tests.
The synthetic complete-record scenario also writes trial-total-cost.json, comparing enabled trial and original candidate notifyTick. It counts provider attempts, D1 statements, ctx.storage get/put operations and logical match-store puts. The D1/DO/provider adapters are mocked. No real row billing claim.

## Cost and release readiness
Scan reservation now adds one durable budget put per provider attempt when enabled. Outcome reservation adds one shared-budget put on top of its existing two retry/sub-budget puts. The final redundant local budget write is suppressed.
One new observation + decision + outcome is 12 SQL statements; a discovery page adds one. The extra index also has write/storage costs not measured by mock statement counts.
No Free-plan acceptance until actual D1 rows read/written (including indexes), real DO behavior and aggregate provider traffic are measured on a separate bounded test environment.
Outstanding: verify production versions again before any release, provision disposable test schemas/indexes/budgets, execute remote integration, then report limits and request activation approval. No new model, rank or threshold is activated.

Initial CI 39696442887 failed at shared usage 3 versus 6 because the integration storage mock did not serialize transactions during the four parallel detail requests. The mock is corrected to serialize; the expected count remains six. This correction does not validate real Cloudflare transaction behavior.
