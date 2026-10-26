# HC step 3 — independent research goal-difference model

Base: 67f60d05132e148e947624313443e2fa0fc202f1. Prior Mobile release remains 24036780-fc63-46e0-a4b9-bf9f9d70c39a from c8182745b3b01f678cac92cf62720f4bda007ec9. This stage has no production deployment, schema changes, credentials, provider calls, D1 writes or scanner changes.

## Source-rule investigation
API-Football's official Odds Live documentation identifies betting-market types and price/handicap/suspension metadata. In the documentation reviewed, no source-specific mapping establishing whether the currently normalized unlabelled feed's Asian Handicap includes already-scored goals was established. Do not infer a settlement policy from an AH label or from another bookmaker's rules. Source reference: https://www.api-football.com/documentation-v3 and https://api-sports.io/documentation/football/v3 . No universal rule is certified by this review.

resolveHCBasis requires an exact source/market/period/PRE-or-LIVE match, dated validity, reference URL and review timestamp, with conflicting mappings blocked. No rule is installed. Existing unknown source rules stay UNVERIFIED; incoming basisVerified flags alone are insufficient for this research resolver.

## Model implementation
HC_TEAM_GAMMA_POISSON_DIFFERENCE_V1 separately estimates each team's remaining-goal distribution. Up to eight valid pre-kickoff completed FT fixtures per team are pooled; duplicates/conflicts/future/current fixtures are excluded. Each unique historical fixture contributes once per target rate: selected-home goals-for or selected-away goals-against, and vice versa for the away rate. Mutual games represent the same observation, not two independent votes. This pooling assumes comparable attacking and opposing-defensive exposures, without calibrated opponent-strength adjustment.

For each team: Jeffreys prior shape 0.5 plus pooled historical target goals plus current team goals; posterior rate equals unique historical exposures plus observed regulation fraction. Gamma-Poisson prediction over remaining regulation time yields per-team PMFs. Their conditionally independent joint distribution produces remaining goal difference. Full-time result summaries add the current goal difference exactly once. No GAP, market odds, arbitrary shot/xG/red-card coefficients or forecast-performance claim enters the model. Added time at/after 90 waits for a suitable model.

The read-only research adapter uses existing FEUIReadBridge HC items and FEOverviewInputBridge team histories. It reports missing DEEP context explicitly and mutates neither bridge. It is not connected to production UI or ranking.

## Validation and limits
Fifteen test groups cover PMF mass and expectation, duplicate/conflicting/future data, score/time posterior, venue identity, odds/GAP independence, remaining-vs-full-score separation, no fabricated time, actual adapter inputs, and provenance-scoped rule resolution. Test inputs are synthetic, not a real forecast/outcome evaluation. No profitability, calibration, real LIVE odds or Push receipt is certified.

## Next gate
Inspect available as-of real team history and future outcomes to evaluate this research baseline. Verify actual source-specific contract basis before presenting a quote as executable. Then implement exact AH settlement and fair odds/EV against that verified contract. Do not overwrite the current HC strength model or TOP ladder with these research probabilities merely because code tests pass. Preserve HT/FT, backend, Free quota and rollback.
