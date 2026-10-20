# HT early evidence — checkpoint 1, 20/10/2026

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

Pressure/chance/game/market weights, calibration, 54/64/72/79 thresholds, Push gate, TOP ranking, eligibility minute20, collector scheduling and FT/HC code remain unchanged. Partial HT observations can still be displayed as accumulating/active; this patch does not require waiting until minute20 to be a future design principle.

## Build and evidence

From repository root:

```sh
node ht-early-candidate/build.mjs
node ht-early-candidate/test.mjs
```

Generated files live only under `ht-early-candidate/generated/`. Root production `notify-core-h1.js` and original Mobile file are not edited. The builder reverses its exact patches and requires byte-for-byte reconstruction of each baseline; no hidden FT/HC or UI rewrite is permitted. Candidate HTML is a generated test artifact, not a production release package.

`build-report.json` records hashes and patch scopes. `test-report.json` includes baseline/candidate replay, limitations, and zero provider requests/D1 writes. Synthetic replay validates mechanics, not real football prediction accuracy or phone Push delivery.

## Remaining work — do not claim complete HT rollout

1. Integrate early-half collection into the actual Mobile and backend scanner paths, starting only when the user turns scanning ON. Reuse discovery data, selectively deepen promising fixtures, and revisit quiet fixtures within a measured Free quota budget. Do not add uncontrolled polling or persist every unchanged sample.
2. Define the estimate of goals remaining in HT and uncertainty from available evidence. Do not convert this strength score directly into a calibrated probability. Existing score-to-probability fallback has not been replaced here.
3. Price the exact HT total line, current score, offered odds, settlement and data age; allow WATCH/WAIT when evidence or a usable price is missing. Preserve TOP1–5 as distinct fixtures without forcing entry.
4. Integrate contract tests, quota replay and a separate browser/phone preview before proposing release. Existing server Push score-only gate and UI qualification are not unified by this patch.
5. Only after validation, prepare a pinned release and rollback. Keep production untouched until that release is ready and authorized.

No claim is made about improved betting returns, reduced production D1 usage or successful LIVE/PUSH with this candidate.
