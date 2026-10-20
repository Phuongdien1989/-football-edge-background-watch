# Football Edge HT — controlled trial deployed, 21 October 2026

Status: TRIAL_DEPLOYED_TECHNICAL_ACCEPTANCE_PASS.
Verified at 2026-10-20T20:46:13.2151086Z (UTC); approximately 03:46 on 21 October in Vietnam.
Release commit: 76eae2e373138adeb0acaa0fff567b784ecd5016.
Reviewed HT code: a9e9cc68cc07af27bdca0305b6f227da12f64cb9, from immutable package run 39491133238.

## Active trial
- Mobile shiny-silence-d892: 0a87e8c1-c1fa-4a89-ac54-ddd47ab6b2ed
- Backend football-edge-background-watch: fe5c9fb5-ae1d-4aa6-8850-8cbdeb2b8e73
- Desktop remains a332ee39-abb2-422d-a021-db78ef19cc10.

Main HT URL: https://shiny-silence-d892.ngophuonghuy.workers.dev/#fe-tabs/ht

The new HT collector starts observing in the first half before minute 20 and warms true halftime history through existing quota wrappers. HT research pricing is displayed when independently sourced data and a matching fresh HT market permit it. Existing FT/HC/Master and Push policy remain inherited. This release does not silently enable early Push.

## Verified
- Original package: 128 manifest hashes checked.
- Backup: 18 original Mobile assets and 29 backend source/configuration files preserved.
- Both original Cloudflare versions exist; runtime backend bindings preserved.
- Scanner OFF (enabled=false, manualEnabled=false, next_alarm=null) before and after release; no scanner toggle was performed.
- Full configured backend dry-run PASS (562.33 KiB, gzip124.63 KiB); Mobile dry-run PASS.
- Actual served Mobile assets match the reviewed package.
- WebKit HTTPS at390px and1280px: five tabs, switching tabs, new HT bridge/module, no runtime page errors, no horizontal overflow.
- Existing /original/ route remains accessible and unchanged.
- Existing backend health reports the release commit; Desktop version unchanged.
- No provider or Push requests were requested by the deployment/QA. Browser backend/provider traffic was blocked; this does not substitute for an authenticated live scan.

Account D1 analytics at preflight, UTC day20October: rows written21404, rows read425188. Account analytics can lag traffic. These values establish available headroom at the check, not future capacity.

## Evidence and old-version preservation
[Release workflow PASS](https://github.com/Phuongdien1989/-football-edge-background-watch/actions/runs/39494486949)
[Original source/assets backup](https://github.com/Phuongdien1989/-football-edge-background-watch/actions/runs/39494486949/artifacts/12297436359)
[Release report and screenshots](https://github.com/Phuongdien1989/-football-edge-background-watch/actions/runs/39494486949/artifacts/12297700365)

Backup/evidence retention:90days. Download the original source/assets backup for an independent long-term copy. It is not a database export and does not include encrypted runtime secrets.

## Exact pre-HT rollback versions
- Mobile:3c0e47ed-275b-410c-b527-77f1ff65a28a
- Backend:04cc044d-412f-4844-9b83-c7c786eedd13
- Old backend source:da5242bb41b2401271f52dda17b0e2208e7e3819
- Desktop:a332ee39-abb2-422d-a021-db78ef19cc10 (never changed)

For a later recovery: verify scanner OFF and that current versions still match this trial. Restore each affected Worker to its exact pre-HT version using Cloudflare Deployments,100% traffic. Verify active versions, backend /health source, the preserved Mobile asset hashes and scanner state. Preserve bindings/secrets/database. Do not re-run the release deployment job against already-changed baselines. Automatic rollback was configured for technical acceptance failure, but was not invoked because all release checks passed.

## Remaining acceptance
User can refresh the main app and manually turn scanning ON when desired.
Confirm actual iPhone/PWA behavior, true-history warm-up, live HT fixture updates and notification receipt.
Record real quota over a representative scan window. Do not equate Push transport acceptance with physical phone receipt.
Forecast probabilities remain research estimates; outcome accuracy and profitability are not verified.
PR13 stays DRAFT pending these checks; no merge of PR6/7/12/13 was performed.
