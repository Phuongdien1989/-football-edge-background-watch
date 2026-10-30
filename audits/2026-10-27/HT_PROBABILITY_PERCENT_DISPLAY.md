# HT probability percentages — shared experimental app

Continues deployed source f906a8b052491782720e026528ef2dd5aa834ee6 (Mobile f837ab1b-0b5e-4ce2-bac8-612f6e6fa7da), integration 2da4ce6de98bf7c43ef7fff09b3cb82ddd37ed97.

User approved starting with HT and publishing in the shared experimental app. Presentation only: no model, threshold, rank, selection, scanner, Push, D1 or backend change.

## Semantics

- Model counts additional goals after current observation. `P(no more goals)=PMF[0]`, `P(at least one more goal)=1-PMF[0]`. Do not read pressure score as probability, or add already-scored goals to the future-goals event.
- Also show `P(full win of Over exact line)` from the existing quote, with separate name. A goal is not necessarily enough to win an Over 1.5 contract.
- In existing expandable pricing detail show all five existing settlement states. Preserve half wins/losses and pushes rather than collapsing them into a binary win %.
- Only binary half-goal contracts get reciprocal-odds break-even; no-vig market probability only when the original assessment supplies both sides. Integer/quarter contracts explicitly do not get a fabricated binary or reciprocal-odds event probability.
- Existing Fair Odds and EV cells remain unchanged. Odds-only changes do not change goal PMF or model win distribution; exact line changes can change settlement probability.
- Require existing modelOK/dataOK, correct independent H1 remaining model, matching model time and valid normalized PMF before showing current percentages. Stale/cooldown/missing context shows WAIT. Missing price may still show independent goal outlook while hiding contract probabilities. Historical ten-minute recommendation remains historical and is not given current percentages.
- Model is experimental and uncalibrated; no prediction accuracy or profitability claim. Nominal 45-minute model does not estimate stoppage time. HT model already returns null at minute >=45; no new estimate invented.

## Scope and release

Replace public ht-candidate/ui.mjs and style.css, add probability-view.mjs. Scope check reverses the formatter import and two display insertions to prove the original HT UI/session/storage/model logic exactly matches the backed-up deployed UI. All 45 other existing assets, including index.html and all HC/FT modules, byte-identical. Full package: 48 assets.

Source tests cover complements, odds invariance, line sensitivity, each Asian settlement, score counted once, guard states, missing price, invalid model/odds, escaping and no I/O. Four-width actual-shell browser tests cover visible %, five-state details, price-only invariance, HT original/current session and ten-minute retention, FT V2 and HC default mount/reference expiry. Browser inputs synthetic; no real phone Push or actual live result certification.

Preflight verifies prior Mobile, backend, static-only bindings and every prior public asset against run 40310006554. Complete backup uploaded before publication; dry-run/candidate/browser acceptance required. Post-publish public hashes and actual navigation checked. Keep previous Mobile for rollback and preserve manual scanner control, backend and Desktop. No automatic scanner activation. Inspect final workflow/report for deployment result.
