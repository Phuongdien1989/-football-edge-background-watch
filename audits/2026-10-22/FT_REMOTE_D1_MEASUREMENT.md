# Isolated remote D1 measurement

Candidate only; no Worker deploy, scanner changes, production schema migration or model changes.

The one-shot workflow reads the three deployed Worker versions and rollback existence, then creates one separately named synthetic D1 database only if the account has fewer than ten databases. Queries are restricted to that newly returned database ID, explicitly excluding the known production ID. Test data is retained. No deletion, plan changes or football provider requests.

Measures actual D1 REST rows_read/rows_written for observation, decision, outcome, exact retry, corrected result, indexed discovery and concurrent reservation. Eight contenders must produce one stored record with one remaining reservation. Errors preserve a report; reruns are disabled. SQL and HTTP counts and observed row totals are bounded.

This is not Worker/DO runtime acceptance. Cloudflare Free documents 50 D1 queries per Worker invocation (https://developers.cloudflare.com/d1/platform/limits/). Current recorder uses eight statements for each new observation/decision pair: twelve pairs alone require 96 statements. Therefore unrestricted trial activation is blocked pending an invocation-level budget or verified query reduction that also accounts for other D1 paths. REST measurements do not resolve this gate.

The fixed record budget is not a total query budget. Reservation failures still issue queries; the persistent pause and discovery gates have separate scope. Synthetic data cannot establish predictive accuracy, ROI, real-fixture coverage or Push delivery.

Results: see workflow artifact ft-remote-d1-audit / remote-d1-audit.json. Report status and deployment versions must be read from the actual run, never inferred from this specification.

## First remote execution

Commit 804d9169d170fb9eb23c705257ef14925efc1e38: foundation CI 39699021385 PASS; remote run 39699021468 FAIL with HTTP 400 / code 7500 at first schema request. No successful SQL metrics. Created and retained exactly one test database fe-ft-replay-audit-39699021468 (e82758f2-e533-44a6-b42d-4821d120e082). Production versions all match checkpoint at 2026-10-22 00:19:48 UTC; rollback exists.

Follow-up script cannot create databases: it only allows the exact ID/name pair above and first requires both replay tables absent. Strips full-line comments from controlled schema inputs; this addresses a suspected REST statement parsing problem, not yet a proven cause. Sanitized API error messages are retained for diagnosis. Existing workflow attempts are not rerun.
