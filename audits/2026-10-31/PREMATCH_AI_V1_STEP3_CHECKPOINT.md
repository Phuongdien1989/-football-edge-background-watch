# Football Edge PRE-MATCH AI V1 — Step3 checkpoint

Date:31 October2026 (Vietnam time). Status: isolated code and preview delivered;
no production deployment, merge, D1 schema change, provider acquisition, Push or
scanner change was performed in this task.

- Base: cf4b2013a12367c1d097c89d03accb55aa5dcbf1.
- Branch: feat/prematch-ai-v1-preview-20261031.
- DRAFT PR34: https://github.com/Phuongdien1989/-football-edge-background-watch/pull/34
- Tested source:2625748a3e39c46f85429aa9cdbc33dad05b08cd.
- Final preview CI PASS: https://github.com/Phuongdien1989/-football-edge-background-watch/actions/runs/41164925110
- Artifact:13028836675, prematch-ai-v1-offline-preview.
- Artifact SHA256:3a9cd9daefb6cd029ead5b0e28553e9173dc4051addf23252e0ac3c86067ea18.

## Implemented

Offline attack/defence ridge-Poisson fitting with learned opponent/home effects,
chronological holdout for ridge selection, explicit availability cutoff and
conflict filtering. HT/H2 are fitted only on true halftime observations. FT,
HT,1X2, totals, differences and HTFT probabilities are coherent. Model artifacts
must match league/time/kind/hash and converge; probabilities do not use odds.

Pricing reuses existing AH/OU maths without editing those modules. It calculates
five payout states, fair odds and EV for1X2/AH/OU HT/FT, with explicit source,
period, signed line and regulation contract. League-only baseline comparison is
model sensitivity, not a calibrated confidence interval. Sign conflict yields
WAIT_MODEL_REVIEW; unconfirmed price/rules and kickoff stop trial entry.

The preview starts empty. LAB uses fictional teams/history/quotes, is labelled
on screen and cannot price a REAL fixture. Worker inference, Vietnamese grounded
narrative, twelve-module status, TOP5 distinct fixtures, local-only evidence
export/save and exploratory validation metrics are implemented. A separate,
opt-in host overlay reads only the existing DEEP bridge on explicit request.
No production entrypoint imports the feature.

## Verification

-21 pure test groups PASS,3,724 AH/OU payout cases.
- Probability mass, HTFT marginals, no odds contamination, no invented HT,
  correct quarter settlement, missing/zero/as-of, model-kind isolation and
  nonconvergent/hash-invalid artifact guards PASS.
- Exported record integrity and read-back validation, outcome corrections,
  missing closing-quote semantics and unique-fixture ranking PASS.
- Offline HTML:320/390/768/1440px PASS; no overflow/page error/external request.
- Copied current Mobile host:390/1440px PASS; open/close overlay preserves route
  and all six previous tabs; production requests0.
- Git tree comparison: all628 pre-existing blobs unchanged.21 newly added files
  only: prematch-ai/* and its preview-only workflow.
- CI has no Cloudflare environment, API token, Wrangler or deployment action.
  It only reads the previously verified Mobile build artifact for host testing.

The initial run41164662571 also passed. Screenshot inspection then identified
an ordering issue (ranks were correct but displayed in input order), fixed in
2625748. Additional exported-record and convergence guards were tested in the
final run. The final source/report above supersedes the first preview.

## Remaining before real-world acceptance (Step4)

No real as-of league dataset or production-trained model artifact was acquired.
Real-data accuracy, calibration, ROI and CLV are NOT certified. LAB outcomes and
large displayed LAB EV are mathematical illustration only, never investment
performance. Need an existing authorized history/DEEP export and verified quote
contracts, then offline fit/replay and prospective evidence. Do not add provider
requests or production schema/writes just to fill the preview.

Dynamic form decay, cross-league strength transfer, numeric player/injury/
tactical effects, Elo/DC challengers, posterior confidence, centralized immutable
server ledger and PRE notifications remain unimplemented/unverified. The UI
states their limits. All forecasts remain experimental/calibrated=false.
Local hashes are integrity checks, not signatures or proof against owner edits.

## How to resume

Read prematch-ai/README.md. Open generated/index.html for the self-contained
preview; select explicit LAB or import canonical FE_PREMATCH_V1 JSON. To fit a
real artifact offline, use cli.mjs train with actual historical availability
and90-minute/HT scores. Validation consumes exported pair records and verified
outcome revisions. Keep PRE inputs independent of odds.

Do not re-run unchanged PASS checks unless a new change affects them. Keep PR34
DRAFT. Do not merge/deploy or inject PRE prior into HT/FT/HC without separate
acceptance/authorization. Retain current production/rollback and PR33 as-is.
