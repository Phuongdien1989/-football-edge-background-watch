# HC — LIVE evidence, readiness and remaining release gates

Date: 2026-10-26. Continues 839defa7a0ed94423c2420110a3ae52336c0a231, PR #25, branch feat/hc-difference-model-20261026. Candidate only; no production deployment.

## Completed implementation

Independent history/score/regulation-time HC model; exact five-state Asian settlement and Fair Odds/EV for both sides; source provenance and two separate hypothetical basis scenarios; existing read-only app bridge integration; immutable original/current five-minute research reference, invalidation and historical expiry; per-team LIVE evidence panel; readiness diagnostics; full candidate packaging and regression.

New evidence adapter reads the actual native HC shape `metrics.home` / `metrics.away`, with nullable shots/SOT/inbox/xG/corners/possession/red. It does not assume HT/FT-style `metrics.total` or `stats_presence`. Stats freshness uses `fresh_at` when present, not a new UI capture to make old stats look new. Red-card context now includes home AND away counts and aggregate when both known. A red-card attribution correction invalidates a reference even when total is unchanged. Missing remains null, never implicitly zero.

The display reuses existing HC GAP/PRE contribution/trend/core/DQ/market-fit labels, retaining native GAP direction threshold. Signed source line describes which team gives handicap; it is not a claim about FT winning chance. Relative shot/xG bars are observed team shares, not cover probabilities. Descriptive LIVE features do not modify model probabilities or source quotes, and neither agreement nor a positive research EV creates entry authorization.

`FEHCResearchPreview.readiness()` exports per-fixture reasons: missing model context, stale/missing team stats, missing quotes/source settlement, and the always-explicit `LIVE_PROBABILITY_UNCALIBRATED`. No hidden API polling, recorder, D1 schema, Push, ranking or production modifications. No paid upgrade.

## Source-rule investigation

Primary sources reviewed:
- https://www.api-football.com/documentation_v3
- https://www.api-football.com/news/post/how-to-get-started-with-api-football-the-complete-beginners-guide (odds/live and bet-ID sections)

The provider describes separate PRE and LIVE bet-ID catalogues, live blocking flags and no retained live-odds history. Registry keys therefore remain exact sourceId + marketId + mode + period + effective date, not a generic AH label or a copied pre-match ID. No reviewed evidence establishes the settlement basis for this app's exact current live feed/source contract. This is an unverified mapping, not proof that no source rule exists. Rules from an unrelated named bookmaker cannot certify `API_FOOTBALL_LIVE_FEED`.

Minimum missing settlement evidence: a rule reference or provider declaration scoped to the exact live source/market and whether existing score is counted. Quote-at score must remain distinct from locally observed score. No request was sent to support or any third party.

## Calibration evidence limitation

Native `hcMaybeStartSignal` stores start score, minute, legacy GAP and quotes; existing calibration assesses subsequent directional goal advantage and qualified waves. That target is not equivalent to final settlement of a particular signed Asian contract. The detached bridges expose current items and DEEP team histories, not a training set of immutable quote-time LIVE observations matched to exact settled HC outcomes.

Do not fit new shot/xG/red-card coefficients using final team histories alone, convert GAP into a cover percentage, or treat a fifteen-minute directional outcome as FT handicap settlement. To remove the calibration gate requires appropriately timestamped per-team LIVE observations, exact quoted contracts and their rules, final corrected outcomes, chronological train/validation separation, and forward checks including calibration and actual five-state payout. No such evidence was produced in this checkpoint. No claim of real profitability, prediction quality or physical Push delivery.

## Reproducible candidate

Pinned baseline source c8182745b3b01f678cac92cf62720f4bda007ec9 / Mobile release 24036780-fc63-46e0-a4b9-bf9f9d70c39a via Actions artifact 12626488620. Baseline has 36 assets; root gets additive opt-in loader, other 35 assets byte-identical. Eleven HC assets = complete 47-file candidate package. No fresh assertion of current Cloudflare active version; release would require a new guarded preflight.

Enable `?hcResearch=1#fe-tabs/hc` ONLY on the candidate package. This is not a newly deployed production URL. Existing app has not been modified. Original HC, HT/FT modules, TOP and manual scanner preserved. Existing rollback remains untouched by this workflow.

## Validation / handoff

Source suites: model 15 + valuation 14 (550 exhaustive settlements) + view 8 + integration 7 + reference/session 14 + LIVE evidence 7 = 65 groups. Chrome standalone and actual app shell at 320/375/390/1280, with synthetic detached inputs and API/non-GET/external network blocked; original HT ten-minute retention and FT V2 score/time/pricing exercised. Inspect final workflow and artifact for PASS/FAIL and screenshots.

Implementation is a complete RESEARCH CANDIDATE, not a complete actionable HC trading release. Remaining release gates are real, not tasks that another guessed coefficient or repeated regression run can resolve: exact source settlement evidence; empirical LIVE calibration/forward evaluation; candidate acceptance and guarded deployment/rollback preflight. Keep PR draft and production unchanged until those gates are resolved. Do not rerun already-passing work without a relevant code change or new failure.
