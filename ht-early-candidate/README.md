# HT early evidence — checkpoint 2, 20/10/2026

Candidate only. No production deploy, Cloudflare credentials, API requests, D1 writes, scan control or changes to live thresholds in this workflow.

## Starting point

- Repository checkpoint: `c929b091e448fd99d751360705fc29a488e7fbf3`.
- Mobile release: `723ae37eac825ef1fe8285c8395826b09eba35c5`, version `3c0e47ed-275b-410c-b527-77f1ff65a28a` at prior release verification.
- Backend production source: `da5242bb41b2401271f52dda17b0e2208e7e3819`, version `04cc044d-412f-4844-9b83-c7c786eedd13` at prior verification.
- These version IDs are checkpoints, not a new claim that current production has been queried in this offline run.
- Build verifies exact deployed Mobile HTML hash and exact HT backend blob. Drift fails the build.

## Completed in this candidate

1. Share one pure temporal/quality implementation between generated Mobile and backend evaluators.
2. Apply the existing display coverage boundaries (80%–130% of target) consistently to window maturity. A two-minute history is not a complete five/ten-minute window.
3. Apply Mobile's existing 70-second continuity boundary to both candidates; discard old segments after interruption, goal, red-card, phase change or explicit reset. Do not delete stored history.
4. Compare acceleration only across distinct, sufficiently covered previous and recent periods with comparable available metrics. Missing comparison is `null`, not invented 100%. A zero previous rate is labelled `FROM_QUIET` or `BOTH_QUIET`, without a percentage bonus.
5. Respect current numeric DQ including zero. Missing values do not default to DQ60 or integrity100. Existing independent integrity bonus remains: DQ0/integrity100 gives 1/5, not 3/5.
6. Route only marked HT evaluations to the corrected trend classifier. Original FT trend path remains byte-identical after removing the single HT dispatch line.

Pressure/chance/game/market weights, calibration, 54/64/72/79 thresholds, Push gate and FT/HC evaluation remain unchanged. HT acquisition now includes the start of the half, while the old actionable model remains restricted to minute20 onward until early valuation is developed. Early observations explicitly carry no strength score or probability and recommend WAIT. This is not the final early-HT recommendation model.

## Checkpoint 2 — actual collection paths

- The production inheritance chain goes through `worker_notify_v135_full_pause.js` → `worker_notify_v132_native.js` → `worker_notify_v131.js` → `worker_notify_v130.js`. The adaptive v133 scanner is not the scanner inherited through this chain. Build pins the actual v130 blob `013e7b05d394a9d4544cfe2d9d8cbec5817e6e93`.
- Backend candidate reuses the existing selected batch and its existing stats/events/odds/half responses. It adds HT history before minute20, including source time and phase, in the same match-state write. No new polling, query, table, daily budget or scan interval is added. Direct scanner invocation requires explicit enabled control; outer pause controls remain untouched.
- Backend existing discovery still begins at API elapsed minute1. Mobile accepts valid reported minute0. Neither path claims to reconstruct minutes before the user enabled scanning or before a real observation was received.
- Mobile candidate uses shared LIVE heartbeat and verified fresh server snapshots when available, without renewing source timestamps. It probes at most five distinct fixtures per existing timer round. One slot always revisits the oldest/unseen fixture; remaining slots prioritize measured activity, not a new betting score.
- A quiet early fixture requests only statistics if missing in the shared cache. Measured activity allows the existing HUB to acquire events/odds, reusing the stats response. Early collection does not fetch previous-match form, standings, players, lineups or half statistics. The existing shared bet-reference catalog can still be fetched/cached by the HUB; the three-request deepening bound refers to fixture endpoints, not all app traffic.
- Current TOP1–5 display remains five distinct fixtures, with full-model scored items ahead of early observations. The HT collection pool retains other current fixtures for revisits. Other mechanisms and Master ranking functions are not edited.
- Stop increments a session token, cancels scheduling and ignores late completions. Already issued HTTP requests cannot be undone. History remains on the phone; a failed/null or cached stats response cannot acquire a new observation time in the early collector.
- Goal/red-card resets and cooldowns carry across minute20. Data with gaps is still labelled honestly by checkpoint1's temporal helper.
- Backend generated evaluator/scanner are isolated artifacts. The production import chain is not redirected to them by this build. A complete overlay packaging/release step is still required before any production rollout; do not deploy the generated scanner alone.

## Build and evidence

From repository root:

```sh
node ht-early-candidate/build.mjs
node ht-early-candidate/test.mjs
node ht-early-candidate/test-collection.mjs
```

Generated files live only under `ht-early-candidate/generated/`. Root production `notify-core-h1.js`, `worker_notify_v130.js` and original Mobile file are not edited. The builder reverses its exact patches and requires byte-for-byte reconstruction of each baseline; no hidden FT/HC rewrite is permitted. Candidate HTML is a generated test artifact, not a production release package.

`build-report.json` records hashes and patch scopes. `test-report.json` covers temporal regressions. `collection-test-report.json` covers actual Mobile start/refresh/stop and HUB acquisition with mocked provider/storage boundaries, backend notifyTick replay, early-history carryover, and FT/HC byte invariance. Tests make zero real provider requests/D1 writes. The single-tick backend replay demonstrates equal API calls and persistence operations; it does not measure Cloudflare `meta.rows_written`, whole-account quota, or 24-hour traffic. Synthetic replay validates mechanics, not real football prediction accuracy or phone Push delivery.

## Remaining work — do not claim complete HT rollout

1. Integrate the generated candidates into a complete isolated overlay/preview package and validate the phone/browser behavior, including synchronization with server snapshots. Current integration tests exercise the collector paths but do not replace real-browser acceptance.
2. Define the estimate of goals remaining in HT and uncertainty from available evidence. Do not convert this strength score directly into a calibrated probability. Existing score-to-probability fallback has not been replaced here.
3. Price the exact HT total line, current score, offered odds, settlement and data age; allow WATCH/WAIT when evidence or a usable price is missing. Preserve TOP1–5 as distinct fixtures without forcing entry.
4. Run traffic-shaped multi-hour quota replay and real staging measurements before proposing release. A five-fixture round limit alone does not prove the entire app fits Free. Existing server Push score-only gate and UI qualification are not unified by this patch.
5. Only after validation, prepare a pinned release and rollback. Keep production untouched until that release is ready and authorized.

No claim is made about improved betting returns, reduced production D1 usage or successful LIVE/PUSH with this candidate.


## Checkpoint 3 — HT contract pricing, 21/10/2026 (Vietnam)

Added pure valuation.mjs and valuation-adapter.mjs. They do not alter the generated Mobile/scanner candidate or production, and do not enable Push/recommendations.

- Reuse existing ft-overview/core.mjs settlement/PMF pricing, with separate HT contract validation. That existing file is unchanged.
- Price exact first-half totals using the current first-half score plus additional-goal PMF once. Integer, half and quarter lines expose full/half win, push and loss weights, fair odds and estimated EV.
- An accepted model must explicitly describe H1 remaining goals for this fixture, score, minute and observation time. No legacy strength-score conversion, automatic FT-to-HT scaling, or inferred zero for missing data.
- No fixed minute20 gate in this pricing interface: an actual HT PMF can be priced earlier. A missing PMF remains MODEL_WAIT. The collector's pre-minute20 evaluator still remains EARLY_EVIDENCE/WAIT because a real HT predictor has not been connected.
- Explicit HT categories, same-score quotes, actual market timestamps and settlement basis are required. The adapter does not use stats freshness as a substitute for market freshness. It does not pair different bookmakers, synthesize absent Under odds, or assume a current price after a goal.
- Only paired half-goal lines produce a proportional no-vig probability. Integer/quarter contracts use settlement-aware EV; a reciprocal price is not a binary probability.
- Default is RESEARCH_ONLY. An explicit trial option can produce TRIAL_OVER for estimated EV > 0, with research/uncertainty warnings. Market agreement alone cannot override a negative offered-price EV. Sensitivity scenarios can show sign changes without pretending to be a calibrated confidence interval.
- Attention ranking keeps at most five distinct fixtures and may retain WAIT candidates. It does not fill five forced bets or change the app's existing Master TOP.
- Pure synthetic contract tests verify mechanics. They do not validate a predictive model, improve forecast accuracy, prove profit or verify phone Push.

Important limit: the inspected FT Overview baseline is explicitly an FT constant-rate research model. It is not reused as an HT predictor. This checkpoint creates an HT pricing boundary; it does not certify that all other historic app models were fully audited or that HT prediction is complete.

Next: inspect the app's goal-potential/HT data dependencies and real available historical half-time data, connect an independently estimated HT PMF with honest sample size/uncertainty, then package and review the actual phone preview. No extra provider requests or quota upgrade are authorized by this offline code change.

Execution note: the local execution environment was unavailable for this checkpoint. Source changes were saved on the existing GitHub draft branch and the repository's offline GitHub Actions workflow is the verification environment. Do not report CI success until that run completes.
