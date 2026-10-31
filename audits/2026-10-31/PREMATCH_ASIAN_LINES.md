# PRE-MATCH market families and Asian lines — 31 October 2026

Scope: PRE-only extension to the existing app, branch feat/prematch-one-shot-scan-20261031, Draft PR #36. Production predecessor/rollback: 0f029118-cf5b-456a-bffa-49902f4aa559.

## Contract acquisition

Six separate families: FT AH, FT OU, FT 1X2, HT AH, HT OU, HT 1X2. A PRE-specific reader uses the raw odds response already fetched by the bounded collector. It preserves available lines instead of passing multi-line bets through the old per-market ten-value truncation or one-primary-AH-pair validator. Existing LIVE readers are unchanged. Only the first four bookmakers in the returned response are covered; no additional odds pages or requests are introduced.

Parsing handles signed selected-team lines, decimal commas and adjacent split lines (0/0.5, -0/0.5, 0.5/1, 2/2.5). Missing line is not zero. Ambiguous side, conflicting explicit label, invalid split or unsupported market is omitted. Asian Handicap is not European three-way handicap, team totals, corners or second-half markets. Explicit first-half market names override legacy category tags.

A quote belongs to its selected team: Away +0.75 is priced against away-minus-home difference plus +0.75. It is not a home-perspective line. Grouping alone converts it to the complementary home-line key. Groups require the same fixture, bookmaker, market, period, settlement basis, receipt time and source update. AH recommendation candidates require complementary selected-team signs; incomplete/conflicting groups remain priced references with WAIT_MARKET_REVIEW, not ranked picks. Duplicate contracts across bookmakers are consolidated for main/backup choice; odds/time/source remain intact.

The existing 2,000-quote session limit is preserved. Reaching it is explicitly reported; omitted quotes are not claimed analyzed. No fake market or odds are generated.

## Pricing and presentation

Each market filter ranks distinct fixtures within that family, chooses a main positive theoretical-EV contract and up to two distinct alternatives, and retains research/model/availability guards. No new arbitrary EV threshold or market-to-model feedback is introduced. Displays include the selected team/side, period, signed line, source odds, fair odds, theoretical EV, exact five payout probabilities and the model breakeven price. Quarter/whole Asian lines do not use inverse odds as a binary win probability.

The family table exposes every retained line and source. Switching a family performs no provider request or backend write. Large incremental analysis inputs are coalesced to one in-flight calculation and the latest pending input, preventing an unbounded worker message queue.

## Genuine HT history

The collector retains halftime scores already present in the same recent-fixture API response; there are no extra requests. The PRE recent-history fallback keeps its original FT Gamma–Poisson distribution unchanged. Where genuine consistent HT/fulltime score pairs exist in the selected historical pool, it learns a halftime allocation with Beta(0.5+HT goals, 0.5+remaining goals) and a beta-binomial split conditional on each team's FT goal distribution. This yields a normalized HT marginal coupled to the existing FT distribution, with HT counts no larger than FT in that coupling. It is not a fixed 50% FT fraction and is not a separately calibrated opponent-adjusted HT model.

Missing, invalid or conflicting halftime observations do not become zeros. Without usable real HT pairs, HT source odds remain visible, but HT probability/EV/recommendation stay unavailable. Both the learned HT extension and the existing historical FT fallback retain limited-history model-review status; confirming price alone cannot validate the model.

## Verification and limits

Dedicated tests cover 13 AH and 13 OU lines, quarter/split parsing, selected-side signs, HT/FT separation, 2,736 additional independent settlement comparisons, five-state probability mass and zero EV at fair odds, incomplete AH pair exclusion, and real-HT/missing-HT behavior. Existing 21 model groups and 3,724 payout cases are retained.

Browser acceptance covers five widths, six market filters, AH lines beyond the old ten-value cutoff, five payout states, available HT valuation from real-format mock half scores, missing-HT waiting state, no provider calls on filter changes, bounded scan/continuation/cancel, and original mechanism controls. Browser provider data is synthetic QA, never embedded as real fixtures in the released app.

No backend model, HT/FT/HC LIVE engine, TOP/EDGE, Push, scanner control, D1 schema or real history is modified. No new provider diagnostic call is requested. Forecast accuracy, calibration, actual bookmaker availability and profitability remain unproven; the displayed choices are experimental research.

## Final release acceptance

Deployed source: 02ef8c63dff73eacf0cb6ff7aa3bcadebecad521.
Mobile version: f80e082e-3492-422d-9ecc-11a0549ad12d at 100%, VERIFIED.
Workflow: https://github.com/Phuongdien1989/-football-edge-background-watch/actions/runs/41178852691 — PASS.
Artifact 13032964827, prematch-scan-release-evidence, SHA256 3e0b7c27441f12d785129b3693c5444837ab0587e1e423ba2545024f8fa75c45.

Published and candidate browser checks PASS at 320/390/540/900/1440px. Includes all six family filters, 13 AH source lines beyond the old cutoff, HT valuation from genuine-format mock half scores, missing-HT waiting, five payout states, no new calls on filter changes, cancellation, continuation, retained tab data, compact headings and price bounds. Existing original mechanism/control regressions PASS. These browser provider responses are QA mocks, not real-market or accuracy evidence.

All 70 public asset hashes verified. Ten existing PRE-only assets changed; one new PRE market-lines module added. Backend source remained 7c22543d019cbec05026974b0f3e43df39ee44a1; scanner OFF and control timestamp 1793429059923 match before/after. No scanner toggle was performed.
Rollback retained: 0f029118-cf5b-456a-bffa-49902f4aa559.

The first candidate attempt (workflow 41178616086) failed a browser check that read the result list before the final incremental analysis completed; deploy was skipped. Analysis coalescing and an explicit complete-batch wait corrected that issue before the successful release.

Use: reload https://shiny-silence-d892.ngophuonghuy.workers.dev/#fe-tabs/prematch, scan a future window, then select FT/HT Kèo chấp or Tài/Xỉu. The card and fixture ranking follow the selected family. No manual per-fixture DEEP is required.
