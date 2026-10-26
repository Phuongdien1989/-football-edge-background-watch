# HC step 7 — immutable five-minute research reference

Continues 14316abcbf91f9dfb6a4e0e5688c43f914869ffb on draft PR #25. Candidate only. No deploy, scanner activation, provider request, D1 write or Push.

## Contract

- Capture the first valid original quote/model valuation per selected fixture, for exactly 300 seconds from initial capture. Preserve initial source, market, signed line, paired odds, quote/observation times, score, phase, minute, model prices and both hypothetical basis scenarios when needed.
- With unknown settlement rules this is explicitly a research reference, never an actionable recommendation. Source RULE_WAIT remains unchanged. No source rules installed, no invented LIVE coefficients, no new probability calibration claims.
- Current data/odds updates independently; original and deadline cannot move. Visible original/current summaries and expandable original five-state valuation retained for comparison.
- New score, phase, observed red-card count, HC reset or exact source/market/mode/period/line/basis change invalidates the old reference for the remainder of its window. Newer goal context invalidates even if its attached quote is older. Invalidated reference cannot become tracking again by reverting old payloads. Current prices still obey original quote/cooldown checks.
- Stale, missing or unavailable inputs pause comparison without deleting the original. Restored valid same-contract data may resume a paused record. Out-of-order observations/quotes cannot overwrite last comparison or original.
- Selected fixture leaving the displayed list can show only a marked historical reference, without current model/price claim. It is not inserted into TOP. Removed after the original deadline, even if no provider event arrives. Old observations cannot restart expired references; new observations AND quote after expiry are needed.
- In-memory only. Reload loses records. At most five current fixtures are processed per update; retain at most twenty records to permit TOP churn; expire after five minutes. At capacity evict references outside the current selection. Bounded last-expiry watermarks (100 IDs). Clock rollback does not resurrect expired records.
- Existing one-second UI clock changes countdown text only. Model/quote reads remain coalesced on existing events or 15-second visible UI refresh/expiry. No scheduling change to scanner.

## Scope and checks

Adds `session.mjs`; adapter exposes detached score/phase/known red counter/reset; controller applies sessions and historical rendering. View adds compact original/current block with expanded original valuation. Ten new HC assets plus existing 36 assets = complete 46-file candidate; 35 original assets still byte-identical, root contains only opt-in loader.

Source tests cover immutability, new price/minute, TTL, stale pause/resume, score/phase/red/reset/contract invalidation, out-of-order data and quote, missing source historical view, expiry/rearm, clock rollback and bounded TOP churn. Real-shell browser tests also verify original 2.10 vs updated 2.70, immutable deadline, preservation through missing context/source, historical expiry, and unchanged HT retention and FT V2 behavior at four widths. All inputs synthetic. No real-phone/production performance certification.

## Remaining

Exact provider settlement evidence, LIVE calibration and forward evaluation, candidate visual review and guarded production release remain separate. Current app is not changed by this workflow. The new five-minute record is not an execution window or a claim that a stale price is still available.
