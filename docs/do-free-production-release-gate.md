# Durable Object Free — production release gate

**Status: NOT READY FOR DEPLOYMENT.** The existing successful tests verify isolated behavior, not Cloudflare Free write-budget safety.

## Verified sources of writes

- `worker_notify_v137_quota50000.js`: one storage write per accepted API request. A 50,000-call day can generate 50,000 writes here alone.
- `worker_notify_v130.js`: one write per scanned fixture; status every scan; budget now only when changed.
- `worker_notify_v136_hot_priority.js`: HOT boosts, scheduler status, push latency history.
- `worker_notify_v135_full_pause.js`: pause status now written only on state change.

## Lower bound, not measured usage

At 50,000 API requests/day and 12 fixtures every 30 seconds, the two dominant paths alone yield 84,560 writes/day. This excludes all other writes and does not establish Cloudflare's billable operations. Use `node tests/test-do-free-write-floor.mjs` for the scenario, and `REQUIRE_DO_FREE_SAFE=1 DO_FREE_DAILY_WRITE_BUDGET=<verified quota> node tests/test-do-free-write-floor.mjs` as a fail-closed check.

## Blockers

1. Confirm actual Cloudflare plan's Durable Object write limit and consumption, rather than treating API-Football quota as DO write allowance.
2. Replace per-API-call durable persistence with a crash-safe reservation design that retains a **strict global API cap** across restarts/concurrency; naive in-memory batching can exceed the API limit after restarts.
3. Preserve LIVE match history, crossing/deduplication, H1/FT/HC/GAP, PUSH and replay semantics when reducing fixture writes. Do not simply discard writes to fit a quota.
4. Run representative end-to-end write counting, restart/crash tests and iPhone PWA Web Push delivery checks.

**Rollback:** user dashboard previously showed active production version `60781a4e` at 100% traffic. This branch must remain isolated until release gates pass. No production deployment is authorized by this document.
