# Accuracy repair — frozen production engine

Baseline: frontend a3ffd320-54ec-4c5b-b7fd-eb6f95edb608, backend 491076a2-78d9-48f0-9050-ffc0f479c531.
Rollback source: rollback/top-watch-before-accuracy-20261010 at 570b8bacf8fa2c75c70704b45400cd16c0eeb6e2. The earlier completed pre-hide sync release also remains available.

## Scope

Backend measurement and persistence only. No R2, frontend upload, UI/theme change, engine weights, thresholds, scan cadence, push acceptance or TOP change. Forecasting code never imports accuracy-core.

1. v139 overrides HC validation: missing/empty/invalid/stale/future GAP is deferred/UNKNOWN, never Number(null)=0. Genuine zero remains a valid neutralization. Pre-fix labels remain unchanged and explicitly unverified.
2. Append immutable ACCURACY_H1_PERIOD and ACCURACY_FT_PERIOD observations; retain original fixed-window rows. Period results require official period score plus reconciled events, include added time, exclude shootout/disallowed goals, handle cancellation and uncertain baseline as VOID/UNKNOWN rather than false MISS.
3. Immutable source contracts retain input snapshot, engine outputs, source health, snapshot version and probability/score/GAP distinction. Legacy records explicitly lack original version/input provenance. Threshold/device copies are deduplicated; different forecasts retain variants within one observation group. Repeated fixture observations are not independent trials.
4. Entry inputs are first-write locked. A stale client cannot reopen a resolved row or replace its line/price/policy. NULL stays NULL. Outcome insertion checks the locked entry and cannot overwrite a previous outcome.
5. Real alarm follows up H1/FT OU paper entries without opening the app. Uses the existing provider validation budget and global cap, maximum three fixture lookups per minute; entry processing every five minutes. No new cron, DB table, schema migration or direct credential extraction. Control pause respected. HC market outcomes are deliberately unsupported until a verified side/line contract exists.

## Measurement limitations

Line semantics follow the existing OU_H1/OU_FT whole-period contract, not FROM_ENTRY/H2. Only decimal prices and quarter lines settle. These are paper observations, not actual bets; executable market prices unverified. CAUTION and WAIT_CONFIRM are not converted to confirmed selections. No paper results feed into scoring/calibration.

Authenticated GET /api/notify/accuracy returns separated period measurements, paper outcomes by policy/engine, backfill completion and alarm status. Existing /validation/summary retains compatibility with explicit target/integrity metadata.

Historical input payloads remain unchanged; authoritative server outcome is in entry_outcomes and entry_decisions outcome columns. Audit-only future code must not mistake the immutable payload's original OPEN field for current resolution. No historical source deletion/relabeling.

## Verification gates

Actual worker chain and SQLite: 58 assertions; missing GAP vs real zero, stale/future, period versus window, H1/FT added time, cancellation, missing event ledger, baseline ambiguity, Asian quarter settlement, NULL storage, first-write entry, duplicate forecasts, stale client replay, authenticated route, scheduler, transaction and report.
TOP ranking: 25 existing cases and frozen inline-engine comparison. Original sync/scanner import tests retained. GitHub deployment requires full WebKit regression and real production LIVE/sync readback; frontend version/hash must stay unchanged. Real background alarm/backfill must be observed. On any failed verification, exact prior backend version restored; additive measurements remain, no data deleted.

Local unit tests are not production evidence. Deployment outcome is reported separately only after the workflow and real endpoints pass. Physical iPhone notification clicks are not independently verified.

## Batch D — evidence-driven follow-up

Batch B deployed backend 60781a4e-70cb-4c02-a036-2528c3048ed5 successfully (run 38046091773, regression job 114195806419, deploy job 114195988010). Real WebKit sync PASS, live list 61 and scan button PASS; TOP empty at that instant, not evidence of successful non-empty TOP promotion. Frontend version/hash unchanged. Actual alarm and backfill observed. Independent run 38046414750 job 114196748736 matched 31 settled CAUTION paper snapshots, one fixture, to official result; 60 paper rows remained OPEN at 17:55. No executable betting ROI claimed.

Actual archived period records exposed first-attempt UNKNOWN with FIXTURE_UNAVAILABLE/FINAL_LEDGER_MISMATCH. Source review found the inherited non-strict provider parser can return [] on HTTP-200 provider errors. Follow-up uses strict validation-only parsing (not scanner/engine behavior), serial budget reservation, transient backoff, and a review-time 48h allowance rather than expiring old signal dates on first backfill attempt. Original UNKNOWN rows remain; appended RECHECK rows supersede only in canonical report totals.

Fair settlement reserves two of three fixture slots on entry-due ticks. Separate tests cover strict provider error versus genuine empty response, budget cap, settlement starvation, retry retention and immutable rechecks. Production gate now checks repair_revision=2 and historical eligible paper entries actually settled; rollback for this follow-up is exact Batch B backend 60781a4e. Original pre-repair backend 491076a2 and all prior source backups remain available.
