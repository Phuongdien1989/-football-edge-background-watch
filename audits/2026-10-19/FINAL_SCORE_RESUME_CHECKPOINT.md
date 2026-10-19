# Final-score evidence continuation — 2026-10-19

Source workflow commit: a0121e66096fd4290d48742b955e2a8a4f2a1f1b.
Run: https://github.com/Phuongdien1989/-football-edge-background-watch/actions/runs/39183034623
Outcome: FAIL / API_PROVIDER_RATE_LIMIT. Stopped on first unhandled logical failure and deleted temporary helper. Backend/Mobile/Desktop deployment versions unchanged. Production D1 rows written by this workflow: 0.

Saved raw sources: 14 unique FT fixtures (2 resumed + 12 newly obtained).
Logical calls: 13; physical attempts: 17; max starts per second: 1; gap between logical calls: 2 seconds plus request duration. Existing bounded retry explains physical attempts beyond 13; soft failures sometimes recovered.
Latest successful response: 73,947/75,000 daily and 427/450 minute remaining. Failed HTTP-200 response 3.776 seconds later omitted all quota headers.
Header daily remaining increased from 73,942 to 73,969 between successful calls four/five. Hence these headers should not be treated as a proven monotonic whole-account live meter. Cached responses or differing counters are hypotheses, not verified causes.

Cohort grew since previous checkpoint: current 149 first-entry samples (67 FT,82 H1), versus 145 previously, because new production entries appeared. The exact 149 rows are saved in provider-final-entry-cohort.json for reproduction. Current incomplete provider-only reconciliation: FT 9 resolved/58 unknown; H1 8 resolved/74 unknown. Overall 17 resolved,132 unknown;112 unique fixtures still pending. Do not compare this incomplete subset directly with the broader stored-snapshot paper audit, and do not declare profitable engines. No real-bet ROI is computed.

The partial reconciliation was saved as an artifact; the workflow did not reach its complete-cohort staging-write step. Saved raw source checkpoint at audits/2026-10-18/provider-final-source-checkpoint.json now contains all 14 rows, so future resumptions skip them. Do not rerun the old job source that only knows two rows; use this updated branch checkpoint.

Separate diagnostic PR #10 resolved its field-visibility investigation and read the existing provider error. Separate PR #11 holds an undeployed Smart Follow/Evidence OFF-alarm fix. No engine, thresholds, UI or Cloudflare plan change.

Next unresolved provider investigation: distinguish whole-key traffic across frontend and backend from provider-side behavior. The original Mobile HTML hash aa4f0f... contains direct provider fetches in football(); backend's DO quota/pacing does not encompass those direct calls. That is a code-level coverage gap, not proof those calls exceeded the limit in this test. Do not change cadence or purchase infrastructure without measurement.
