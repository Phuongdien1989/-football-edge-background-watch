# Football Edge FT AI V2 — HT/HC isolation audit
Date: 2026-10-23 (ICT). Scope: **Draft PR #16 only, NO backend production deployment**.

## Direct answer
FT AI V2 work has not been deployed into the user's current production HT/HC runtime; Mobile Outbox is a separate previously released patch. Existing HT, HC and TOP should remain on their active production code. Future FT V2 deployment **could** affect HT/HC indirectly unless shared systems are measured under live load. This is a *test candidate*, not production certification.

## Source review
- `worker_notify_v130.js` uses distinct H1 and HC histories `item.h1History` and `item.hcHistory`, but the entire scanner, provider quota and some match-state writes remain shared.
- `ft-audit-fix/ft-events.mjs`: FT events reset `item.history`, `ftResetAt` and `ftCooldownUntil`, and clear FT UI engine and goal estimate. This should not clear `h1History`, `hcHistory`, `item.cooldown`, alerts, or H1 score. Any wholesale `history` clearing is still a shared persistence concern and must be checked against new unrelated features.
- `ft-audit-fix/patch-recorder.mjs`: replay observations/pairs use opt-in FT flags and bounded SQL budget; source/market fair-pricing code is **offline only** and does not feed H1/HC TOP or Push. FT discovery *can* consume additional provider API calls when explicitly activated. Shared D1 Free billing may still be exhausted.
- No evidence that HT/HC live metrics, delivery latency or daily D1 write budget stay constant under an active FT replay trial across real fixtures. Never assert full isolation based on mocks.

## New regression evidence
Full offline candidate CI [39879115452 PASS](https://github.com/Phuongdien1989/-football-edge-background-watch/actions/runs/39879115452) (commit `e7364659ee07a756a2c6d9525804d94e7e0e78e4`):
- With FT replay sidecar **OFF**, compare candidate Worker vs same candidate with recorder patch in first half: **H1 signal scores/modes, H1 statistics snapshots/history, HC statistics snapshots/history, device alerts, provider call sequence, Durable Object storage puts, and logical match writes identical**.
- FT replay sidecar **OFF**, in second half: HC statistics/history/score, existing Goal Radar evaluation, device alerts, provider calls, DO and match writes identical.
- FT replay recording **ON**, in a mocked second half: HC statistics/history/score, existing Goal Radar results, alerts and provider calls, logical match writes identical; new FT ledger writes are expected separately and not claimed free.
- Legacy recorder integration, old FT settlement 28 cases and FT bookmaker evidence 32 cases remained PASS.
- Intermediate CI [39878980798](https://github.com/Phuongdien1989/-football-edge-background-watch/actions/runs/39878980798) failed only because the new test added two mock D1 rows to the existing shared fake database; test now explicitly clears those mock records after asserting and final CI PASS. No safeguard was relaxed.

## Deployment acceptance — strict scope
1. FT trial remains a distinct feature flag. Do NOT merge/deploy to production now. No unapproved scanner activation.
2. Before rollout, compare actual HT/HC/TOP and Push (same input fixtures) for both disabled FT and enabled FT, including alerts, order, cooldowns and no loss in API cadence. Stop rollout on real regressions.
3. Measure **account-wide** D1 writes, provider requests, backend availability and client IndexedDB ACK during a bounded supervised trial, after D1 Free new-day reset; daily quota from Oct22 already exceeded. Additional FT writes cannot starve existing HT/HC.
4. Verify rollback of BOTH Mobile and Backend independently. No claim a code PASS is evidence of real FT predictive edge or live rollout readiness.
5. Existing FT binary `goal_ft` is not a final-goal-count PMF. Continue constructing a separate, validated FT total-goal distribution off production with leak-free chronological replay.

**Status:** HT/HC risk screen OFFLINE PASS on one fixture and device mock; production remains unchanged; real shared-resource and multi-fixture HT/HC regression gate still pending.
