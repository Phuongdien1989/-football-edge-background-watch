# FT AI V2 — Step 3A checkpoint: bounded replay SQL (2026-10-22)

## Scope / preservation
- Only `ft-audit-fix/` recorder-trial and its test/workflow change on **draft PR #16**. Production Worker, HT/HC, original FT, mobile, desktop, TOP, Push, scanner and rollback unchanged by this change. No production D1 migration, data capture, scan or deploy attempted.
- Supports planned Over/Under dual-side AI V2 by protecting the append-only OBSERVATION→DECISION→OUTCOME provenance recorder; does **not** change pricing, probabilities, recommendation thresholds or UI.

## What changed
- `replay-sql-budget.mjs`: replay-sidecar invocation budget, hard ceiling 24 SQL executions (config can lower via `FT_REPLAY_TRIAL_SQL_BUDGET_PER_INVOCATION`). Counts attempted `first/all/run` executions, including failures; covers concurrent executions. Reinitialized at staged `notifyTick` start and explicit trial outcome entrypoint.
- `worker-recorder.mjs`: before each new record require 4 replay SQL slots (reservation, prior-hash read, insert, verification read). If unavailable, return `SQL_LIMIT_DEFERRED` **without persistent error-pause**. Prior record persists; partial observation/decision remains auditable, never inferred as negative outcome.
- `pending-discovery.mjs`: query for unresolved outcomes through same SQL meter; no extra API calls by budget code.
- `outcome-pass.mjs`: requires at least four remaining SQL slots before reserving/fetching final-fixture provider data; stops on `SQL_LIMIT_DEFERRED` rather than spending repeated API quota on results it cannot store.
- Transformed-worker integration includes module in isolated artifact; normal Notify scanning continues if replay SQL is deferred. No write is automatically refunded.
- `test-replay-sql-budget.mjs`, `test-outcome-pass.mjs`, `test-recorder-integration.mjs`, workflow: unit and transformed-worker tests verify count, cap, concurrency, reduced budget and normal legacy Notify flow.

## CI / evidence
- Latest candidate commit before documentation: `49509321d4905b07f0eabad4d5946f773ace58a6`.
- CI **PASS**: https://github.com/Phuongdien1989/-football-edge-background-watch/actions/runs/39735585054
- Previous intermediate commits briefly failed in transformed test harness before injection was corrected. These runs are superseded by the green final run.
- This verification uses mocked D1/DO/provider and local SQLite tests; NOT actual Cloudflare Worker/D1 acceptance or a model backtest.

## Remaining blockers (release FAIL / pending)
1. Budget cap 24 covers **only FT replay SQL**, **NOT the total D1 queries** made by inherited Worker/DO/mobile or additional request paths. Cloudflare D1 Free limit is 50 queries per Worker invocation; a full shared invocation budget or proof of safe overhead is required.
2. Need real Cloudflare Worker+D1 read/write and index measurements, daily Free row limits, actual run timings and quota under scanner's peak/off modes. No production writes or new provider calls authorized by this candidate.
3. Outcome discovery and persistence can be **deferred** by SQL budget. Need measured recall/completeness (linked observation+decision+resolved regulation result), prioritization across multiple fixtures, no blind data-loss claims, and a bounded recovery policy.
4. Source timestamps, corrections and replay anti-leakage still require real fixture acceptance. Models trained on stored legacy scores are not valid labels. No fair probability/EV, confidence calibration or actual ROI validation is asserted.
5. Before release, recheck actual Cloudflare deployed versions, rollback, dry-run gates and obtain owner approval.

## Next checkpoint request
**3B**: measure aggregate D1 queries per Worker invocation plus daily rows, using an isolated remote trial if authorized; report exact totals and blockers. **3C**: audit chronological replay joins and final score coverage. Continue to keep the scanner OFF unless user explicitly enables it.

Source reference:
- https://developers.cloudflare.com/d1/platform/limits/
- https://developers.cloudflare.com/d1/platform/pricing/
