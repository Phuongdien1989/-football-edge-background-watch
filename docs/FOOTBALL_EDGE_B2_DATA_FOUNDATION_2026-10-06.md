# FOOTBALL EDGE — BATCH 2 DATA FOUNDATION

Date: 2026-10-06  
Branch target: `work/prediction-v2-audit-20261006`  
Production deploy: **NO**  
Scoring/threshold change: **NO**

## Objective
Use the paid API-Football Ultra allowance as a data advantage without turning new information into new hard gates.

B2 establishes four foundations:
1. provider-aware quota truth;
2. efficient live data acquisition;
3. richer team/player/lineup/availability features;
4. shadow-only integration so no current signal is blocked by the new context.

## Finding 1 — quota state is split today
Foreground P2.0.5.2 already reads API-Sports headers:
- `x-ratelimit-requests-limit`
- `x-ratelimit-requests-remaining`
- `X-RateLimit-Limit`
- `X-RateLimit-Remaining`

But Background Worker v137 still enforces a local `API_TOTAL_DAILY_BUDGET=50000` counter. That counter does not know how many requests the foreground iPhone has made directly with the same API key.

B2 candidate changes quota authority to:
`PROVIDER HEADER / STATUS → effective remaining → local counter only as fallback/telemetry`.

The candidate defaults to 75,000/day and 450/min, but if provider headers report another plan, the provider value wins.

## Finding 2 — the current Ultra Hub can spend calls more intelligently
Current live hub can independently poll per fixture:
- `/fixtures/statistics`
- `/fixtures/events`
- `/odds/live`
- `/fixtures/statistics?half=true`
- `/fixtures/players`
- `/fixtures/lineups`

API-Football supports `/fixtures?ids=ID1-ID2-...` for up to 20 fixtures and returns embedded events, lineups, fixture statistics and player statistics in one request.

B2 acquisition therefore uses:
- `/fixtures?live=all` as global heartbeat;
- `/fixtures?ids=...` in groups of <=20 as shared detail hydration;
- `/odds/live` separately because live market history must be captured in real time;
- `half=true` only where H1/H2 split genuinely needs it;
- slow context on provider update cadence rather than wasting calls by refreshing unchanged data.

The aim is not to save quota for its own sake. Calls removed from duplicated live polling become capacity for broader coverage, player/lineup context, market history and validation.

## Finding 3 — personnel data exists but is underused
Production already has:
- fixture player ratings/live stats;
- lineups and formation;
- injuries/suspensions;
- substitutions/red cards;
- team/recent/standing/prediction context.

However the current PRE side evidence reduces injuries mainly to a raw count difference (`home injuries` vs `away injuries`). Three reserve players can therefore appear more important than one elite starter.

B2 adds shadow features:
- squad/player relative importance;
- top/star players by within-team evidence;
- current XI strength relative to expected core;
- rotation index;
- missing-star share;
- injury-core share;
- live player rating pulse;
- rest days and matches in last 7/14 days;
- recent PPG and recent goal-difference rate;
- season/venue PPG and attack/defence baseline.

These are **features**, not rules. No value can make a fixture FAIL.

## Candidate implementation
### `prediction_v2/api-budget-manager.js`
- reads provider rate-limit headers;
- observes `/status` usage payload;
- models quota pace until the 00:00 UTC reset;
- detects `SURPLUS`, `NORMAL`, `AHEAD_OF_BURN`, `LOW`, `VERY_LOW`, `RESERVE`;
- allows broader enrichment when quota is under-used;
- protects live-critical calls when minute/daily quota is tight;
- provides exponential backoff after 429.

### `prediction_v2/bulk-acquisition-plan.js`
- chunks fixture IDs at maximum 20;
- plans live heartbeat + bulk embedded detail + live market calls;
- plans slower context endpoints by their natural refresh cadence;
- adds `/players?team=...&season=...` for season player evidence;
- supports pagination expansion;
- applies budget decisions without touching football scoring.

### `prediction_v2/context-feature-layer.js`
- normalizes season player statistics;
- ranks player importance relative to teammates;
- measures lineup/rotation/star/injury/rest/recent/team context;
- outputs only a shadow feature packet;
- explicitly emits no PASS/FAIL, probability, price or stake decision.

### `worker_notify_v138_provider_quota75k.js`
Candidate only. It:
- inherits same-day v137 local usage on first initialization;
- defaults to 75K instead of 50K;
- persists provider daily/minute headers after Worker API calls;
- uses provider remaining in effective remaining, so foreground calls are indirectly visible;
- keeps a tiny reserve to avoid consuming the literal final calls during concurrency;
- does not alter H1/FT/HC/Goal Radar/Push/D1 scoring semantics.

## Tests
Local candidate harness: `prediction_v2/test-b2.mjs`

Result: **PASS**
- provider header parse;
- budget decision;
- 20-ID chunking;
- live plan generation;
- player normalization/relative importance;
- star/injury/lineup feature extraction;
- rest/recent calculation;
- slow context planning.

## Non-regression lock
B2 does NOT:
- deploy production;
- change P2.0.5.2 frontend;
- change current TOP ranking;
- change FT/H1/HC thresholds;
- add a player/lineup/injury hard gate;
- change Push policy;
- migrate D1 schema.

## Next integration step
Before B3 Prediction/Ranking, integrate the B2 feature packet in SHADOW mode beside each live candidate and record it with validation evidence. Then compare whether each feature adds predictive lift. Only measured lift may later influence model weight.
