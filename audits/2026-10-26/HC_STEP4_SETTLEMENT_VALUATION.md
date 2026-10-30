# HC step 4 — exact Asian settlement, Fair Odds and EV

Continues PR #25 at aca80870b871a896d85ab6acf73f4c6aee1a8dfd. Research-only source change; no production deployment, new requests, writes, credentials, scanner, HT/FT or ranking changes.

## Contract arithmetic
Remaining goal difference is HOME-AWAY. FULL_MATCH adds the current home-away score once; REMAINING_MATCH adds zero. A signed handicap belongs to the selected team, with the away selection using the opposite observed home line. Whole/half lines have one settlement leg; quarter lines split equally into adjacent half lines. Each probability mass is assigned to full win, half win, push, half loss or full loss.

Win weight = full win + 0.5 half win. Loss weight = full loss + 0.5 half loss. Decimal Fair Odds = 1 + loss weight / win weight when win weight is positive; otherwise null. EV = win weight * (odds - 1) - loss weight. This is not generally 1/full-win probability. A full-push distribution has zero EV and no unique break-even odds.

Synthetic regression: current score 0-1, two future home goals, HOME -1.25 at 2.00. FULL_MATCH yields a half loss (unit EV -0.5 for this deterministic scenario), while REMAINING_MATCH yields a full win (+1). It is unsafe to silently choose one convention.

## Gates and read-only integration
reviewHCQuote requires this model version, fresh model/quote times, matching fixture and observed score, exact source quote, proper LIVE/PRE phase and FT period, valid decimal odds and quarter line, no suspension, and no cooldown. Explicit source-specific rule resolution is mandatory before returning one chosen price basis. No installed rule exists for the unknown live feed.

Without verified source rules, return RULE_WAIT, no selected prices or recommendation, and separately labeled hypothetical FULL_MATCH/REMAINING_MATCH scenarios. With an exact verified rule, return RESEARCH_PRICED and both HOME/AWAY model valuations. There is no auto-pick, tradeReady remains false, and no probability-calibration or profitability claim is made. Incoming basisVerified flags alone cannot verify a rule.

readHCPricing consumes the existing HC/team-history bridges once each, evaluates at most 50 actual quote pairs per fixture, and mutates neither source. These candidate modules are not mounted in the production UI and do not replace HC strength/TOP logic.

## Evidence
Existing model suite: 15 test groups. New valuation suite: 14 groups, including 550 exhaustive side/line/difference settlements using an independent integer-arithmetic oracle, symmetry, partial payouts, fair-odds zero-EV identity, invalid inputs, rule ambiguity, freshness/phase/score gates and the complete bridge→model→valuation path. Inputs are synthetic; no real-market performance or physical Push validation is claimed. GitHub workflow publishes logs and source package.

## Next
Build a clearly labeled HC research card using the existing live inputs, retaining old HC strength analysis. Show rule status and hypothetical scenarios when the basis is unknown; never relabel a user-selected assumption as a provider-verified rule. Review and validate that preview before any production deployment.
