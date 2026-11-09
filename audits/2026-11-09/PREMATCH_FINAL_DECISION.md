# PRE-MATCH final decision — 9 November 2026

User goal: the app must conclude which concrete market/line to consider, at what price and why, rather than stop at probabilities/EV/research labels. Work continues from e33560f26de6ae3f40aac17b0941a6ea070c1459; existing app is preserved.
Branch: feat/prematch-final-decision-20261109. Draft PR #37.

## Declared experimental decision policy

PM_FINAL_MAXIMIN_LOG_PAYOFF_V1 compares exact five-state profit/loss distributions. For decimal odds o, the unit payoffs are [o-1, (o-1)/2, 0, -1/2, -1]. For internal normalized exposure f in [0,1), it evaluates sum p_i*log(1+f*x_i). It numerically maximizes the minimum of those expectations over the base model and available compatible model variants. The optimized exposure is not exposed as a stake recommendation. This is a declared log-utility preference, not proof of objective superiority, safety or real profit. The classic expected-log criterion is grounded in Kelly (1956); the finite-scenario maximin extension and quote-verification priority are this application's experimental design.
Primary reference: https://doi.org/10.1002/j.1538-7305.1956.tb03809.x (J. L. Kelly Jr., A New Interpretation of Information Rate).

Candidate requirements preserve the existing fixture, source, clock, period, line, suspension and AH-pair checks. Positive worst-scenario EV and positive comparison score are required; no new arbitrary percentage cutoff is added. A genuine confirmed/available source quote is preferred over an unconfirmed indicative quote. Remaining choices sort by the declared score, worst-case EV, full-loss probability and deterministic contract identity. Economic equivalents (Home win vs Home -0.5; Away win vs Away -0.5) and duplicate contracts across bookmakers cannot fill multiple backup slots.

At most one candidate per fixture enters the window TOP 1–5; at most two other fixtures are global backups. Each market family has its own decision view. A recommendation is explicitly TRIAL_PICK, with separate quote-confirmation and model-review flags; tradeReady remains false. Uncalibrated history models are not silently upgraded to validated models. When available model scenarios remove the positive advantage, the result waits for evidence instead of forcing a pick. Missing data, no current price advantage and closed PRE states are distinct.

Forecast probabilities, goal models and settlement math are unchanged. This policy can still select an outsider if the unvalidated model strongly overestimates it: a different ranking function does not cure model error. No market probability is fed back into prediction. All uncertainty disclosures remain necessary.

## Visible conclusion

An upfront FINAL PICK card shows the match/league, concrete HT/FT side and line, source odds, model breakeven, lowest EV among considered scenarios, a data-based reason and explicit risks. It clearly distinguishes the trial choice from confirmation of a currently usable bookmaker quote. NO_ENTRY, WAIT_PRICE, DATA_WAIT and CLOSED_PRE do not pretend that a trade is available. Per-match analysis and TOP rankings use the same decision layer, so the top conclusion and detail card do not silently use different policies.

## First-decision evidence

A separate IndexedDB database fe_prematch_final_decisions_v1 preserves first assessments and first paper picks by fixture, policy, family and source kind. No existing database is upgraded or deleted, so predecessor rollback retains the old local-ledger schema. New writes are local only and failure is shown without stopping analysis. Stored decisions, forecast identity/cutoff, source quote, model payout probabilities and assumptions are exportable. First records are not overwritten when later source prices or recommendations change.

A pure validator accepts verified period outcomes, checks hashes/contracts, deduplicates first-record keys, and computes exact simulated Asian settlement. Records are paper observations, not confirmed real bets or actual financial ROI. Families must not be summed into a fictional combined portfolio. Automatic acquisition of final outcomes/calibration is not added in this release; that remains a separate data/validation task. Local hashes do not provide tamper-proof server attestation.

## Tests and boundaries

New tests show a case where lower raw EV but better payoff risk is selected; compare the numerical log objective with a dense independent grid; reject nonpositive worst-scenario advantage; cover confirmed/unconfirmed price, waiting/no-entry/missing/closed states, stale/mismatched source clocks, equivalent contracts, distinct-fixture backups, paper settlement and hash tampering. Existing model/settlement regressions remain unchanged. Browser acceptance additionally checks the visible conclusion and a real local IndexedDB first-write-preservation test, using isolated QA provider data.

No extra provider calls, D1 writes/schema changes, backend changes, Push messages, scanner toggles or LIVE HT/FT/HC/TOP/EDGE modifications. Mobile-only release retains predecessor version 28b182ba-1ea7-4c56-8d90-9d69e5493865 and checks backend/Desktop drift before mutation. Source regression success is not evidence of forecasting accuracy or successful real bookmaker execution.

Implementation source: 099fea29b9f817031f4ad5d399c1d6810c0de7f6.

## Release loading and rollback

The first candidate passed isolated browser checks, but the published acceptance encountered an old PRE-MATCH status instead of the final-decision panel. Release 42600121746 automatically restored the predecessor Mobile version; it is not a successful acceptance result. The corrected package retains all 70 original assets byte-for-byte except the two PRE-MATCH entry references in index.html. Seven new assets include versioned view, stylesheet, runtime, worker and entry paths plus the decision and local-ledger modules. The versioned module graph prevents mixing the old runtime with the new view. Per-match backup options now use the same final-decision alternatives as the primary selection, with a browser assertion rejecting a repeated primary.

Browser fixtures are intercepted QA data, not actual provider or betting outcomes. Published acceptance verifies executable production assets with those isolated inputs. Forecast calibration, realized profitability and real provider data remain separate verification boundaries.

## Final acceptance

- Source commit: 099fea29b9f817031f4ad5d399c1d6810c0de7f6.
- Actions PASS: https://github.com/Phuongdien1989/-football-edge-background-watch/actions/runs/42600703899.
- Active Mobile version: 1aa06a8c-3cd0-423d-b9ea-fbb24fc6d57f (100% deployment; public hashes verified).
- All 77 public assets verified; original 69 non-entry assets unchanged. Only index.html PRE-MATCH entry references changed among the original 70.
- Candidate and published browser acceptance PASS at 320/390/540/900/1440. Original mechanism and controls regression PASS. New final-decision and real local journal browser checks PASS.
- Backend source unchanged at 7c22543d019cbec05026974b0f3e43df39ee44a1. Backend/Desktop versions unchanged by release guards. Scanner remained OFF with the same control timestamp. No provider requests or production D1 writes were generated by release verification.
- Rollback retained: 28b182ba-1ea7-4c56-8d90-9d69e5493865; all 70 predecessor public assets preserved in artifact backup/.
- Evidence artifact: 13665144490, prematch-final-decision-evidence, SHA256 031309603852d007afa6edc57806198970edd428db0d3ddbb2a1554aebb769fb. Retention: 90 days; this is not permanent independent archival.
- PR #37 remains DRAFT/OPEN; no merge performed.

To use: refresh the official Mobile app, open PRE-MATCH, choose 1/2/3 hours and press Quét PRE-MATCH. FINAL PICK appears after eligible data is analyzed; WAIT/NO ENTRY/DATA WAIT remain valid conclusions. The release does not automatically start scanning or send PRE-MATCH Push. Live forecast quality, calibration and realized returns remain unproven; QA acceptance is not evidence of investment success.
