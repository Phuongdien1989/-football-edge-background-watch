# FT OVERVIEW — main-app experimental recommendations enabled

Owner instruction on 19 October 2026: put the feature into the main app and allow normal experimental recommendations while observing results, without waiting for proof of profitability.

Tested source: `9629821089991e603a90ae9bd04f4ebf262ebf0d`.
Main frontend version: `b73642ec-1d4c-41ae-bc28-68c785b6fd79`, 100%.
Workflow PASS: https://github.com/Phuongdien1989/-football-edge-background-watch/actions/runs/39264773115

## Available now

https://shiny-silence-d892.ngophuonghuy.workers.dev/#ftOverviewCard

The normal root now contains the collapsible FT OVERVIEW card. Main HTML explicitly enables experimental recommendations with data-fo-trial=true. The old view remains at /original/; a full original HTML copy remains pinned in git.

## Trial policy

- Uses the independent RECENT_RATE_TIME_ONLY_V1 baseline already supplied by existing DEEP history; never substitutes old market-influenced HT/FT scores for probabilities.
- For current, consistent full-match FT prices and usable model data, positive estimated EV produces TRIAL_OVER (Cân nhắc Tài). Non-positive EV waits for price. No arbitrary positive-margin cutoff or bookmaker-agreement cutoff is introduced.
- TOP 1–5 are distinct fixtures; positive estimated EV candidates lead, then model-priced candidates compete by estimated EV; ties remain stable. This is experimental ranking, not proven quality.
- Missing/stale/error/cooldown input cannot recommend. LIVE requires at least one genuinely observed statistic; a genuine zero is accepted. PRE historical estimates do not require nonexistent LIVE statistics.
- Paired full-match total lines already reached by the current goal count are rejected, preventing misread remaining-goal or stale lines from appearing to be guaranteed wins.
- Quarter-goal settlement, current goals counted once, provider price timestamps, original cooldowns and deduplication stay in force.
- Records include model, policy FT_OVERVIEW_TRIAL_EV_V1, line, price, estimated EV, fair price and source observation time, in the candidate's existing bounded browser journal.

## Verified

36 focused tests PASS. Released main-page browser smoke verifies recommendation rendering with a synthetic QA fixture, negative-EV wait, missing-LIVE-statistics wait, valid-zero handling, cooldown suppression, preserved original cards and original-view availability. QA fixtures never entered app engines, D1 or real histories.

Backend remains 04cc044d-412f-4844-9b83-c7c786eedd13; Desktop remains a332ee39-abb2-422d-a021-db78ef19cc10. Original Push service worker and manifest bytes preserved. No scanner toggle, provider call or D1 write was performed by release/smoke. Original HT/FT/HC scoring, thresholds, TOP and Push were not changed.

Immediate rollback: ac8c0da2-551c-4561-a554-efd4c09339ad (verified version exists; full working static bundle retained). This final release did not rehearse rollback.

## Honest operating limits

The model is still an uncalibrated recent-rate/time-only research baseline: it does not adjust for opponent strength, live intensity or red cards and does not supply calibrated uncertainty. Its estimates and ranking are not proven betting advantages. The owner accepted observing this trial. Missing DEEP context still means MODEL WAIT; the feature does not fetch extra provider history automatically.

The new recommendations are on-screen. No new FT OVERVIEW Push channel or server ledger was added. Existing upstream statistics rate-limit issues are not claimed resolved, and real-fixture recommendation quality/LIVE-PUSH outcomes are not established by synthetic QA.
