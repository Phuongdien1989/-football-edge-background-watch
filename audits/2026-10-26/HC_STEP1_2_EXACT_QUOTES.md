# HC step 1-2 — preserved baseline and exact quote contracts

Base development commit: 06cf1b969debfaf3d217ab668782b108135f88f9. Mobile before: d329296b-7da6-4fc7-9e6f-7e25c6662f0e. Backend: e7d2090c-d0e1-4f58-9f5a-4360acd2ced3. Desktop: a332ee39-abb2-422d-a021-db78ef19cc10.

## Verified defect and repair
Previously median HC line and median odds from nearby (+/-0.25) lines could form a synthetic pair. New parser retains each exact home/away complementary quarter-line pair from a single source and update, including explicit main/alternative lines, provider/hub timestamp provenance, observed score, source/market identity and settlement metadata. It rejects malformed/non-quarter lines, invalid odds, suspended/stale/future/fixture-score mismatches and conflicting same-time duplicate prices. PRE analytics remain supported; LIVE callers reject PRE rows. A negative split such as -1/1.5 is -1.25, not -11.5.

The consensus median line/breadth is reference-only. The selected line and both odds always come from one observed quote; even a median between actual quoted lines is never converted into a synthetic tradable line. Missing bookmaker names are explicitly a provider feed, not invented distinct bookmakers.

History compares the same source, market, phase, basis and score; changing source starts a new reference instead of generating a market move. Line movement can be analyzed on the same source; odds movement is compared only when the line is unchanged.

## Important boundary
The normalized feed does not establish bookmaker-specific settlement rules merely by carrying an AH label. Unknown full-score vs remaining-match basis is stored and displayed as UNVERIFIED. Observed score is explicitly not a provider-attested score-at-quote when absent. No source metadata or probability is fabricated. tradeReady remains false; no fair-cover probability or betting EV is introduced. These repairs make inputs internally consistent; they do not certify an executable bookmaker contract or forecasting profitability.

## Scope and delivery
One published asset changes: index.html, using 11 asserted HC-only replacements reversible to the exact prior root. General market normalization, HT/FT functions, models and numeric thresholds are not edited. All 35 external assets, HT retention, FT V2 and navigation remain identical. Market-fit results may legitimately change because inputs are repaired. No backend/D1/Push/scanner schedule changes, new API calls or schema changes. Future integration build applies the same explicit HC patch while preserving its original baseline reconstruction check.

Before deploy, workflow verifies version/asset guards and preserves the complete 36-asset package and version metadata. Regression includes strict quote/history tests, entire inline-script syntax compilation, original HT/FT source regression, future builder, candidate/published browser checks at four widths, HT retained-reference expiration, FT state-pricing and all tabs. Restore preceding Mobile if post-deploy acceptance fails. Artifact versions/hashes are the deployment evidence.

## Next stage
Review and verify actual settlement basis for each supported source before calling a quote trade-ready. Then develop a separately versioned HC goal-difference model and exact Asian settlement/fair-odds tests; do not convert GAP to probability, reuse FT total-goals probability as cover probability, or treat 15-minute team confirmation as AH settlement. No HC model changes belong in this step.
