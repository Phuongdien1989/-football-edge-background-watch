# Provider final-score investigation — 18 October 2026

## Confirmed facts
- Detailed ids request run 39117579047: after roughly 8 minutes without a check request, one logical bundled request returned HTTP 200 classified API_PROVIDER_RATE_LIMIT. Quota headers and Retry-After were absent.
- Basic single-id run 39117725186: 3 logical requests, 6 physical attempts through the existing client's bounded retry path; two fixture responses succeeded, then the third stopped on API_PROVIDER_RATE_LIMIT. Maximum starts observed by that instance: 1/second.
- A successful response advertised daily limit 75,000 with 53,861 remaining; the next advertised 53,860. Minute limit 450, remaining 449 then 448.
- The internal 50,000 prepaid reservation cap still had ample headroom. It is a separate accounting upper bound, not the provider's actual account usage.
- Failed responses still had HTTP 200, no rate-limit headers, Retry-After 0 and response_count 0. rate_scope MINUTE comes from the existing sanitized error-text classifier, not from rate-limit response headers.
- We cannot attribute the provider rejection specifically to shared IP, account restrictions or an undocumented endpoint limit from this evidence alone. A provider-side minute-related refusal is observed; exhaustion of the advertised daily plan is not supported by the successful adjacent responses.
- Basic endpoint shape alone did not eliminate intermittent errors. No additional automatic probes were started after this run.

## Checkpoint
Two provider-verified source fixtures are committed in provider-final-source-checkpoint.json:
1555512 and 1507451. Their two retained first FT paper observations both resolve LOSE under the existing whole-period OU assumption.
This is not a replacement for the earlier 29-fixture reconstruction and is not a new full-cohort ROI estimate.
124 unique fixture IDs were in this job's cohort. 2 have saved sources; 122 remain to verify. Across H1/FT, 143 of 145 sample keys remain unknown in this independent-refresh subset.

The driver automatically loads the committed source checkpoint when FE_RESUME_SOURCES_PATH is absent. It skips sample keys already resolved from those sources and checkpoints every subsequent successful batch.
Further independently verified sources should be appended to a later checkpoint; do not restart from an empty list.
No probe was made just to validate this file-loading change; syntax checks and normal staging QA apply.

## Evidence
- Bundled diagnostics: https://github.com/Phuongdien1989/-football-edge-background-watch/actions/runs/39117579047
- Basic verification + saved partial sources: https://github.com/Phuongdien1989/-football-edge-background-watch/actions/runs/39117725186
  Artifact 12133117286 (provider-final-checkpoint).
- Central ledger QA PASS: https://github.com/Phuongdien1989/-football-edge-background-watch/actions/runs/39117725207

Both temporary check Workers were deleted. Production D1 writes were zero. Backend 2be01a61-cc5d-43c7-9c6d-13e581296453, Mobile 03c1d55d-358a-448b-96f3-f356704831df and Desktop a332ee39-abb2-422d-a021-db78ef19cc10 stayed at 100%.

## Remaining action
The independent refresh is blocked by the observed provider refusal, not by unfinished local arithmetic or ledger tests.
Before another bulk attempt, obtain sufficient provider diagnostics/confirmation for the intermittent HTTP-200 refusal, or verify an available permitted request path with a small bounded check. Do not bypass cooldown, increase account limits, or infer an IP block as a confirmed root cause.
Keep the production app, selection logic and thresholds unchanged. The current implementation and ledger are staging only.
