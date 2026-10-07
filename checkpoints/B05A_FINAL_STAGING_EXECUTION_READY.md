# B05A FINAL — staging execution checkpoint

Prepared: 2026-10-07

## Immutable source
- Required package: FOOTBALL_EDGE_FINAL_PRESTAGING_FIXED_2026-10-07(2).zip
- Required SHA256: 68f2a8a9b0233a9fcf4cba9c53961ca9dd9dd06deeb533f8f78fe74c9ed0f03f
- Local package manifest was verified before preparing this branch.
- Remote workflow refuses mutation unless the exact ZIP is available as the named GitHub Actions artifact and passes the SHA256 check plus SHA256SUMS_FINAL_FIXED.txt.

## Isolated targets
- D1: football-edge-b05a-staging (new only)
- Worker: football-edge-b05a-staging-bridge
- URL: https://football-edge-b05a-staging-bridge.ngophuonghuy.workers.dev
- D1 binding: BATCH05A3_STAGING_DB
- Forbidden production D1 ID: 0d12a7cc-12a9-4c71-b55b-61dfd2dac4d4
- main/production/model are out of scope.

## Smoke guard
- 1 pinned fixture
- max 600000 ms
- max 40 provider attempts total including status/discovery/details/retry
- APISPORTS_KEY from GitHub Actions secret
- bridge token generated at runtime, masked, same value supplied to Worker and Node
- stop/fail closed on quota/key/integrity/persistence/ACK/limit failures
- evidence export/upload runs even on failure

## Approval
Workflow: .github/workflows/b05a-final-staging-smoke.yml
Exact dispatch approval phrase:
RUN_STAGING_SMOKE_1FIXTURE_600S_40ATTEMPTS

No workflow dispatch has been performed at this checkpoint. No Cloudflare resource was created or modified and no API-Football request was made.

## Remaining source-handoff constraint
The connected GitHub tool cannot upload binary bytes from the conversation/container to GitHub. Therefore the exact FINAL ZIP still needs to exist as GitHub Actions artifact named football-edge-final-prestaging-fixed before the remote workflow can pass its source gate. The workflow deliberately fails before Cloudflare mutation if that artifact is absent or its SHA differs.
