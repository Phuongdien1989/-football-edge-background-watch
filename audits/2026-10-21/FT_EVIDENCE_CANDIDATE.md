# FT evidence and catalog candidate — 21/10/2026

Extends 971a53aa6ae83a009fecc23dba60c1d16663ef71. Candidate only; no deployment.

## Runtime candidate changes
- Existing events response is inspected before the missing-statistics branch. Recognized Red Card / Second Yellow card evidence invalidates FT output without manufacturing a numeric red total.
- Duplicate/reordered evidence does not extend cooldown. Empty or errored events never mean red count zero. Disappearance of previously seen red evidence is marked unconfirmed, not a proven rescission.
- On a successful LIVE catalog, a previously tracked 2H fixture absent from that catalog is marked FT_CATALOG_UNCONFIRMED; old FT probabilities are cleared. It is NOT labeled ended. Repeat absence is idempotent. Return requires a new snapshot/baseline.
- No new provider requests or revised forecast thresholds. Shared H1/HC histories and cooldown are preserved by these new hooks.

## Staged observation contract
ft-audit-fix/observation.mjs is NOT wired into Worker, D1, DO or deployed package.
It creates explicit source receipt/status/payload records, preserves null and unknown source times, rejects future receipt/source timestamps, and stores outcome in a separate record type. This is only serialization groundwork; it does NOT itself guarantee complete coverage, authenticity of caller-provided timestamps, leakage-safe feature extraction, immutable database storage or final-score verification.
Future capture must reuse each existing response and cover scanned fixtures regardless of recommendation. Training/test splitting must be by fixture and chronological time. The fixture object and source payloads must be screened for target leakage before feature extraction.

## Validation
26 market + 16 original event/clock + 17 evidence/record tests + 8 Worker/UI cases pass locally.
Real candidate Worker and FT engine are used with mocked network/storage in integration cases.
Logical write measurement (not production billing):
- goal plus missing stats: baseline 1 putNotifyMatch, candidate 2.
- newly missing catalog fixture: 1 immediate put.
- events-only red with missing stats: 1 final put.
- staged observation serializer: 0 runtime writes.
These counts are scenarios, not a daily quota guarantee. Payload sizes, broader workloads and Cloudflare billed writes still need measurement before deployment.

## Remaining limits
No provider timestamp is available merely because we fetched statistics again. Receipt/change clocks are diagnostic; exact provider freshness cannot be certified from unchanged counters alone.
A missing LIVE fixture is not resolved without an explicit subsequent final fixture result; no extra endpoint call is introduced here.
Event evidence is not a numeric field-player red-card model. Substitutes/staff, ambiguous identities and disagreement between events/statistics require reconciliation before a future pricing model uses red counts.
No new model accuracy or end-to-end Push claim. No collection activated or schema changed.
