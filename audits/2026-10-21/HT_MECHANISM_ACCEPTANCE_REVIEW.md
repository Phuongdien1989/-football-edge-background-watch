# HT acceptance review — 21 October 2026

Production code reviewed: d521619f3319ff715e61e745a2f25fbc3b286ddc. Mobile 0449307e-c464-4959-82b6-c4825789e568; backend fe5c9fb5-ae1d-4aa6-8850-8cbdeb2b8e73; immediate Mobile rollback bbddcaa4-1536-4f4e-852a-83f8ffd88b83. This review changes tests/documentation only. No release, scanner toggle, provider requests, D1 writes or prediction changes are authorized by its workflow.

## Implemented behavior

- Collection can start from minute 0 when manually enabled. At most five distinct fixtures receive detailed work per cycle, with an oldest-first scouting slot; this is not full simultaneous observation of every live fixture. Existing 10/15/22-second Mobile cadence and provider caches remain.
- Historical HT model uses up to eight actual completed halftime-score records per team, deduplicated by fixture; one valid record per team is sufficient to construct the research baseline. It does not require all eight. Context/sample dates are guarded against future observations.
- Gamma–Poisson forecast depends on halftime history, current score and elapsed nominal time. It is independent of offered price, but does not yet incorporate live pressure/chance quality, opponent strength, red-card scoring-rate changes or stoppage time. Minutes 0 and 45 have no model price; collection eligibility does not mean pricing eligibility.
- Quotes require the HT total category, valid line, price above 1, usable first-half data, source timestamps no older than 55 seconds and post-reset timing. Quarter/integer settlement includes existing goals exactly once. Binary probability comparison is limited to half-goal lines.
- Local five-minute records preserve the original contract and deadline; updated goals/red/phase/reset invalidate them when those updates reach the session book. Expiry, waiting and reload recovery are covered by existing regressions. Records are browser-local, not durable cross-device Push records.
- Existing HT watch states use 54/64/72/79 score thresholds. They are not the new probability/EV model and should not be described as interchangeable with a user-configured Push threshold. New HT card valuation is not wired as the source of current TOP/Push selection.

## Confirmed acceptance failures

### HT-A01 — known score discarded when statistics observation repeats (HIGH)

`refreshH1Watch` calls `appendHistory` before handling score/reset events. If a new heartbeat/snapshot reports 1–0 but retains the already-observed statistics timestamp, appendHistory rejects it. The duplicate branch only copies market fields when old/new scores match. Otherwise the incoming score is dropped; the stored item remains 0–0, without a reset. The session book therefore cannot immediately invalidate a recommendation from the known new goal. This is an integration defect despite the session module's direct goal-invalidation test passing.

Required fix: process event/phase identity separately from statistics-history deduplication; invalidate old quote/session immediately without pretending cached statistics became newly observed. Do not append duplicate history, renew source times or add API calls. Cover goal, red, phase and repeated unchanged responses.

### HT-A02 — VAR/score corrections do not reset legacy continuity (HIGH)

`h1WatchResetEvent` only returns GOAL when total goals increase, and RED_CARD when the red count increases. A 1–0 to 0–0 correction returns null; a changed allocation with the same total also returns null. New session score checks are stricter, but the upstream legacy momentum/cooldown/reset timestamp can remain unchanged.

Required fix: identify score/correction events without conflating them with a newly scored goal, reset continuity and reject pre-event quote evidence. Test decreasing totals, changing score allocation, red-card corrections and unchanged payloads. Preserve original records for validation.

## Remaining acceptance gaps

1. HT pricing and HT TOP/Push use different decisions. Do not silently replace legacy ranking or Push with an unvalidated research model; define and test one explicit versioned decision contract first.
2. The proposed reconciliation of pre-match foundation, live reality and market is incomplete: live observations are collected but not yet a validated update to the current forecast.
3. New browser-local recommendation sessions have no complete durable outcome/ROI/closing-price evaluation, nor completed phone Push end-to-end acceptance. Existing legacy validation counts cannot be represented as validation of the new model.

## Decision

HT remains a research trial, not fully accepted. Fix HT-A01 and HT-A02 with integration regressions before declaring it stable or moving the same mechanism to FT. Then verify current live data transport and phone Push separately, and explicitly resolve decision/ranking/Push boundaries. No extra prediction weights, sample-size cutoffs or stronger claims are introduced by this review.

The audit workflow deliberately fails mechanism acceptance when these defects reproduce, while its separate production job uses GET-only Cloudflare operations to check active versions, all deployed asset hashes and rollback availability. A passing deployment preflight does not override failed mechanism acceptance.
