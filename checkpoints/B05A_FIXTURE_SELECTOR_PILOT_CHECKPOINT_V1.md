# FOOTBALL EDGE — FIXTURE SELECTOR / PILOT CHECKPOINT V2

Status: READY_FOR_SINGLE_USER_APPROVAL
Production/model: FROZEN / UNCHANGED
Provider calls in this preparation batch: 0

## Independent smoke baseline
Run 37648059824; artifact 11496021709; SHA256 682a4f9cfe1d4121bacd771c53ea8498515eafff294eeac1adad93978a1b7c23.
40 attempts, 40 captures, 8 locked observations, 8 OLD exact outputs.
Fixture 1627266 source discovery: 2H minutes 66,67,68,69,70,71,72,73.
Observation ID FT:FT fields are engine=FT and market_period=FT, NOT match phase. V2 selector/runner now derives and carries match_phase=H2 explicitly. Regression is bound to the artifact digest.

## Real selector module
validation_runtime/fixture-eligibility-selector.js is the canonical selector.
validation_runtime/eligible-pilot-runner.js imports that module directly and is the pin gate.
No ids[0]/ids[1] positional selection is permitted in the approved pilot path.

FOOTBALL_ELIGIBLE:
- live fixture with derivable match phase;
- statistics payload has at least one usable numeric value; zero is valid;
- events payload exists and is structurally valid; [] = VALID_NO_EVENTS and remains eligible;
- no future received_at beyond cutoff.
MARKET_ELIGIBLE adds usable supported live market. Missing market does not remove football eligibility.
Low activity, 0-0, zero shots/goals/cards are never rejection reasons.

## Remote-mutation guard
Offline workflow is .github/workflows/b05a-offline-validation.yml and is workflow_dispatch-only.
The next remote workflow must also be workflow_dispatch-only and require explicit approval.
Before deploy/secret mutation/provider access it must read durable budget/stop. Active stop or exhausted budget fails closed before avoidable remote mutation.
The old push-trigger staging workflow is not an approved pilot path and must not be used for further commits/runs.

## Exact 40-attempt budget
TOTAL = 40.
RESERVE = 20 attempts for 4 comparable OLD+NEW ticks.
Each post-pin tick costs exactly 5 attempts on the current path:
1 /status + 1 /fixtures discovery + 1 /fixtures/statistics + 1 /fixtures/events + 1 /odds/live.
4 ticks = 20 reserved attempts.

PRE-PIN SELECTION CAP = 20 attempts total, INCLUDING status/discovery, all eligibility probes and any retry.
Selection must stop before consuming attempt 21.
A candidate probe is counted by actual provider attempt, not logical request. Retry consumes another attempt.
If no football-eligible fixture is pinned by the selection cap, stop NO_ELIGIBLE_FIXTURE_WITHIN_BUDGET; reserved 20 are not spent.
After pin, no retries may cause the four-tick reserve to be violated; if remaining budget cannot fund the next complete 5-attempt tick, stop before starting it.

## Freshness / candidate rule
Historical candidate 1517361 is only a discovery hint, never a prequalified fixture.
At approved pilot time it must be rediscovered live, pass current freshness/status, stats and events gates, and compete under the same selector as every other live fixture.

## Required pilot output
attempts total + by endpoint; selected fixture and eligibility; captures; observations; OLD exact outputs; match_phase per tick; stats/events/market states; received_at leakage audit; persistence/ACK/readback; separate football and market eligibility; outcome/settlement; OLD vs NEW on identical raw/cutoff only.
No outcome or insufficient sample => CHUA_DU_BANG_CHUNG. Technical smoke never means NEW > OLD.

## Offline verification
Existing 30 prediction_v2 test programs PASS after selector addition.
Direct runner-import + artifact phase regression PASS.
No provider call was made by these tests.
