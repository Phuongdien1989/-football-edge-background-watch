# Football Edge — prediction accuracy audit, 2026-10-10

## Decision

Predictive and betting performance is NOT proven. Do not change selection/engine thresholds in response to raw HIT percentages. Current evidence shows a probability calibration concern, incomplete betting outcome tracking, correlated observations, and a reproducible HC validator defect. First repair measurement and audit failure cases with the engine frozen.

Production frontend was read and matched active TOP WATCH hash 157af7294df17b997f505a6fa0a4658699c8236808a643e29ca2d71bd1b8b392. Audit performed no production data/worker/frontend mutations. Official provider readback used 107 GET requests, 56 fixtures, no provider errors. No new R2 deployment.

## Sources

Inventory/validation read-only workflow: https://github.com/Phuongdien1989/-football-edge-background-watch/actions/runs/38020523045 (SUCCESS).
Independent official final-score/events audit: https://github.com/Phuongdien1989/-football-edge-background-watch/actions/runs/38020712244 (SUCCESS).
Raw exports and independent rows retained in their respective workflow artifacts for 90 days. Source code is audit-accuracy.mjs and audit-outcomes.mjs. Historical records were not overwritten by retrospective checks.

## Observations

- DB: 411 push validation rows, 204 entry decisions, 0 entry outcomes, 27 QSIG rows (5 FT, 22 HC, zero H1). BET_TRACKER: 1 OPEN, zero settled bets. These do not establish real-money ROI.
- Original stored FT 10-minute validation: 9 HIT / 27 MISS / 13 UNKNOWN. H1 5-minute: 1 HIT / 10 MISS / 4 UNKNOWN. UNKNOWN is not a loss. Original data includes historical versions and clustered/repeated signals; not a clean holdout for the latest release.
- Last 7 days stored FT: 2 HIT / 12 MISS / 3 UNKNOWN; H1: 0 HIT / 4 MISS / 1 UNKNOWN. Official final-ledger recheck finds FT period-goal hits 7/17, H1 period-goal hits 0/5. These are notification observations, not 17 or 5 independent betting picks.
- Independent official FT recheck: 48 observations over 38 fixtures, 23 had another goal by end of regulation including added time (47.9%). All 48 recorded probability sources were MODEL; mean displayed probability 65.4375%. Observed success is about 17.5 percentage points below mean predicted probability. This is a descriptive warning, not a significance test or proof of a stable error magnitude. Calibration, version mixture, and correlated samples require examination.
- Independent FT uncensored fixed-window recheck: 11/41 hits within 10 minutes. H1: 2/14 hits within 5 minutes; full H1 period: 4/15. Seven FT windows and one H1 window cross the period boundary and are flagged censored. Existing HIT/MISS labels agree with the independently reconstructed uncensored cases where an original resolved label exists. Additional resolved checks include originally UNKNOWN cases, so rates differ from the DB summary.
- Raw push 411 records collapse to 315 distinct fixture+kind+timestamp events, demonstrating duplicate rows due in part to different device thresholds. Even 315 is not guaranteed independent: repeated same-fixture waves and overlapping windows remain.
- Of 204 entries, 113 HC are observation-only and 91 H1/FT remain OPEN in DB. Offline official-score settlement was possible for all 91 H1/FT, but they belong to only FIVE fixtures (last 7 days: 87 observations, FOUR fixtures). There were ZERO SUITABLE entries: 84 CAUTION, 7 WAIT_CONFIRM.
- Raw independent paper sum was +53.25 units across 91 recorded observations (+58.52% raw snapshot ROI), under existing app's total-period OU line interpretation. This number MUST NOT be treated as strategy ROI: repeated alternatives on five matches, no executable line proof, no confirmed entry strategy, and no real placed bets. The first recorded observation per fixture/engine yields only five opportunities (three losses/two wins, +0.875 paper units total), still insufficient and not a SUITABLE strategy.
- Independent QSIG source review first page: 1 CONFIRMED, 19 MISSING_DATA out of 20, with another page remaining. HC review explicitly requires original live-state replay; no full independent source-backed reliability conclusion from this page.
- At inventory time backend scan 8/8 fixtures was degraded with no usable stats. This is an observed input-quality limitation at that instant, not proof all historical forecasts lacked data.

## Root causes verified from production source

1. **Target mismatch:** notify-core/Goal Radar calibrates FT against goal_ft (goal before end of regulation); PUSH_FT_10M validator asks whether a goal occurred within ten minutes. A correct full-period prediction can fail a ten-minute test. H1 numeric score is an engine score, not a calibrated 5-minute probability. Report targets separately before judging forecast accuracy.
2. **HC missing-data defect:** scanner v130 records last.gap=null with sourceHealth.stats=EMPTY when stats vanish. Production v131 resolver uses num(null), which becomes Number(null)=0. Reproduction with original resolveGapValidation method, fresh missing stats and starting GAP +73 produced NEUTRALIZED, gap_end=0, gap_delta=-73. Absence was misclassified as neutralization. Of 347 stored HC rows, 214 are NEUTRALIZED, 24 remain same direction above threshold, 53 same below, 3 flipped, 51 unknown, 2 pending. The defect can contaminate neutralization counts; it does NOT prove all 214 labels are false. Do not relabel without individual source evidence.
3. **Measurement does not establish pick profit:** HC validation checks persistence of signed GAP, not whether the recorded AH selection covers its exact line at its price. H1/FT entry outcomes currently depend on foreground/manual resolution, and none have been written as settled outcomes. Existing real bet tracker remains OPEN.
4. **Small/correlated empirical calibration:** MODEL-labelled probability is an estimation/fallback regime; source code uses score-to-probability sigmoid with empirical shrinkage when samples are sparse. The stored official pool (5 FT, no H1) cannot prove robust calibration across league, score, minute, red card or pressure/threat contexts.
5. **Evidence and selection bias:** repeated snapshots/devices/thresholds inflate counts; observed entry alternatives do not form a frozen executable strategy. Full candidate logging is needed to measure missed opportunities. Replaying currently available final data as if it were known at signal time would leak future information.

## Improvement sequence (proposal; not deployed)

1. Freeze active engines/ranking/push thresholds and preserve current rollback. Define immutable prediction contract per record: engine/version, forecast target/horizon, timestamp/availability, probability vs score vs GAP, source quality, fixture phase/score, market semantics/selection/line/price, confirmed vs observation.
2. Repair validation only: null is missing, real zero remains valid; classify unavailable HC as UNKNOWN/wait, never neutralization. Separate end-period probability from 5/10-minute forecasts and censored windows. Preserve original labels and append independent review versions. Add regression for missing stats, real GAP 0, future/stale sources, red cards, added time, cancelled matches, duplicate deliveries and quarter-line settlement.
3. Resolve recorded normal-finish H1/FT paper outcomes independently with server follow-up, retain exact market semantics, and keep CAUTION/WAIT_CONFIRM separate from confirmed executable picks. HC requires side/line/final-score cover settlement and an appropriate forecast model. Bet Tracker actual outcomes remain a separate stream.
4. Audit weak cases by data/logic/market/timing: H1 misses, FT MODEL overconfidence, high pressure but low goal threat, dominant-but-sterile possession, market divergence, reset/cooldown, source loss and notification latency. Strict received-at replay must expose only evidence available at the original decision time.
5. Run frozen prospective evaluation with fixture-level separation and matched controls. Measure probability calibration/Brier, exact pick paper and actual ROI, outcome coverage/unknowns, drawdown and missed opportunities. Compare candidate improvements on independent fixtures; alter production engine/thresholds only after evidence improves quality without regression.

No proof that the app is profitable; no proof all forecasting logic is useless. The supported conclusion is that current evidence is insufficient, H1 deserves investigation, FT MODEL probability looks optimistic on this historical sample, and validation must be repaired before using its aggregates to tune the model.
