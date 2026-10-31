# PRE-MATCH explicit scan — 31 October 2026

Repository: Phuongdien1989/-football-edge-background-watch.
Branch: feat/prematch-one-shot-scan-20261031. Draft PR #36.
Release source: 5c4fc5e83078dbaed9013c9764dda0b91495dd5e.

## User-visible behavior

Select a Vietnamese-time window (maximum 24 hours), then press Quét PRE-MATCH. Each explicit batch processes at most five distinct upcoming NS fixtures and makes at most 40 new physical provider requests. Quét tiếp advances the same catalog without duplicate processing. Dừng prevents further requests; an already-sent request may finish. No network scan starts on mount, tab switching, visibility changes, or an automatic schedule.

The app reuses its existing API configuration, cache, in-flight request map, header accounting, error handling, odds normalizer and historical prediction model. Endpoint allowlist is limited to fixtures, odds, league coverage, injuries and lineups. New calls are paced 750ms apart. Known daily exhaustion and fresh minute exhaustion stop acquisition. A persisted minute header alone cannot indefinitely lock out later requests. Provider rate-limit/cooldown stops the batch with partial results; there are no automatic retries.

Histories are acquired before odds. Forecast math is independent of quotes. Injury/lineup facts remain explanatory evidence and do not invent probability adjustments. Empty or unavailable data is explicitly distinguished; missing true HT history does not create an HT forecast. Conditional regulation fair odds/EV may populate a candidate list but retain WAIT_RULE. Explicit user confirmation of period, settlement and available price is required for OPEN_TRIAL; confirmed quotes expire in at most five minutes and always before kickoff. No actual betting action occurs. TOP ranks only analyzed fixtures, with one fixture per rank and at most two global backups.

Collected results remain available when changing tabs within the current page session. Cache is local; there are no new D1 writes, schema changes, subscriptions, Push sends, or scanner controls.

## Evidence

Model regression: 21 groups and 3,724 independent settlement cases PASS.
Collector/bridge: VN midnight/exclusive window, 5+2 distinct batches, cache, missing API key, cancellation, stop-on-rate-limit, endpoint allowlist, 40-call cap, pacing, missing quota headers, daily quota, minute freshness and conditional-pricing guards PASS.
Browser: published and candidate 320/390/1440px; provider responses mocked, no real user key, no external mutation. Covers explicit acquisition, cache, continuation, candidate status, explicit confirmation, cancellation, retained tab results, no auto requests, readable fixture strip and full-width datetime controls. Existing HT/FT/HC session/card and native scan-control regressions are separate checks.

Release workflow: https://github.com/Phuongdien1989/-football-edge-background-watch/actions/runs/41168239771
Earlier successful scan release: https://github.com/Phuongdien1989/-football-edge-background-watch/actions/runs/41167882710
First browser attempt failed only on a cached-cancellation test timing issue before deploy; no production version changed in that attempt.

## Real source probe — explicit limit

A separate authenticated temporary helper attempted at most four logical reads through the existing backend global quota/pacer. It stopped on the very first call with API_PROVIDER_COOLDOWN. No fixture, histories or odds were received. The helper was deleted. This proves a current backend source guard, not the condition of the independent frontend direct-provider path on the user's phone. It does not prove a successful real forecast, phone notification, or model accuracy.

Proof workflow: https://github.com/Phuongdien1989/-football-edge-background-watch/actions/runs/41167964665
Proof source: 27e5aefc2401e1dce212de2e221b67a6a5ceedb7 on diag/prematch-source-proof-20261031.
Artifact: 13030445002, prematch-real-source-proof. Status SOURCE_BLOCKED; one logical request attempted; temporary helper removed; scanner not toggled.

## Preservation and limitations

Backend remains version fcf19574-3498-4ef3-9d08-d9fb575df365, commit 7c22543d019cbec05026974b0f3e43df39ee44a1. Desktop remains a332ee39-abb2-422d-a021-db78ef19cc10. Existing HT/FT/HC engine files, TOP/EDGE, Push, D1 schema, and source data are unchanged. Scanner remains under user control.

Immediate previous Mobile rollback: a505ee35-bed2-42e0-aec8-e4b121867967 (functional scan before the Mobile polish).
Pre-scan rollback also preserved: 33ab421a-eb8a-4f06-8e4b-2ce6a262b70c.

The runtime falls back to the existing recent-history Gamma–Poisson model when no fitted league artifact exists. It is not opponent-adjusted or calibrated, does not quantify validated uncertainty, and does not implement all 12 research modules. Staging/browser success must not be claimed as real-data forecasting accuracy or successful phone delivery. PRE has no new automatic background scan or Push.

## Final release acceptance

Production Mobile version: c495503f-89a1-4a92-90b1-610f7d029345, 100% traffic, status VERIFIED.
Deployed source: 5c4fc5e83078dbaed9013c9764dda0b91495dd5e.
Workflow 41168239771: PASS, including published UI and all 69 public-asset hashes.
Artifact 13029827825: prematch-scan-release-evidence, SHA256 cdda2404b4c11df6c6edd10acd3a0bc2db1a47b950913ecdc99d4e65eda592e9.
Published browser checks PASS at 320, 390, 1440px with provider mocked. Only index.html private acquisition bridge and PRE view.css changed in the final polish relative to the immediately preceding 69-asset version. Backend source, scanner enabled state and control timestamp matched before and after.

Use: https://shiny-silence-d892.ngophuonghuy.workers.dev/#fe-tabs/prematch
Select a future Vietnamese-time window, press Quét PRE-MATCH, then Quét tiếp 5 trận if needed. Reload the app to load the new frontend. Existing API key configuration is reused; a missing key produces an explicit configuration error. No DEEP opening per fixture is required for the new acquisition flow.
