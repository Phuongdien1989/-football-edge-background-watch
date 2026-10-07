# FINAL PRESTAGING — concrete checkpoint
Verified 2026-10-07 via read-only GitHub Actions, latest run 37637682076.
Repository: Phuongdien1989/-football-edge-background-watch
Branch: checkpoint/b05a-final-readonly-20261007

## Verified
- Existing GitHub Cloudflare credentials are available and authenticated metadata reads returned HTTP 200.
- Cloudflare workers.dev subdomain: ngophuonghuy.
- Dedicated staging Worker football-edge-b05a-staging-bridge returned HTTP 404 / code 10007 for secrets and deployments.
- Complete D1 list returned HTTP 200: 3 returned / 3 total; no exact staging-name match.
- APISPORTS_KEY is now available to the GitHub runner (presence verified, value never printed). BATCH05A3_BRIDGE_TOKEN will be generated for the new dedicated staging service.
- Existing background Worker lists APISPORTS_KEY as a secret name; its value and provider validity/quota were not read.
- 0 API-Football requests; 0 Cloudflare resource mutations; production unchanged.

## Proposed target after approval
Worker: football-edge-b05a-staging-bridge
Expected URL after enabling workers.dev: https://football-edge-b05a-staging-bridge.ngophuonghuy.workers.dev
D1: new dedicated football-edge-b05a-staging, actual ID obtained from creation.
Binding: BATCH05A3_STAGING_DB.
Forbidden database: football-edge-db / 0d12a7cc-12a9-4c71-b55b-61dfd2dac4d4.
Node source: GitHub-hosted Ubuntu runner, Node 24, FINAL FIXED ZIP.
ZIP SHA256: 68f2a8a9b0233a9fcf4cba9c53961ca9dd9dd06deeb533f8f78fe74c9ed0f03f.
Bridge token: generate securely inside staging workflow and bind the SAME value to staging Worker and Node process; never print it or store plaintext in artifacts. Retain access for stop/export while workflow runs.
APISPORTS_KEY: must be available securely to Node runner; Cloudflare's stored secret name alone cannot supply its value.

## User configuration completed
APISPORTS_KEY availability verified in run 37637682076. No further key/token input needed. Provider key validity and quota remain untested and will be checked inside the approved 40-attempt cap.

## Approval checkpoint
Do not deploy or make provider requests until explicit approval of this target.
Approved remote operations would create dedicated D1, inspect schema, apply fresh schema once, deploy dedicated bridge, configure bridge token, verify authenticated bridge, run/stop/export/audit.
No production deployment, production schema update, model change or plan purchase.
Total provider cap 40 includes status/discovery/details/retries and restart. Duration cap 600000 ms; one pinned fixture; stop on unknown/insufficient quota or persistence/ACK/integrity failure.
Provider status validity/quota is tested ONLY inside this authorized budget; stop if invalid/exhausted.

## Commands from FINAL FIXED root
Configuration preflight: CFG=<private-config> bash staging_kit/batch05a-final-ops.sh preflight
Fresh D1 schema: FE_APPROVE_REMOTE_SMOKE=YES WRANGLER=<staging-toml> bash staging_kit/batch05a-final-ops.sh db-init
Deploy: FE_APPROVE_REMOTE_SMOKE=YES WRANGLER=<staging-toml> bash staging_kit/batch05a-final-ops.sh deploy
Run: FE_APPROVE_REMOTE_SMOKE=YES CFG=<private-config> bash staging_kit/batch05a-final-ops.sh run
Stop: CFG=<private-config> bash staging_kit/batch05a-final-ops.sh stop
Export: CFG=<private-config> bash staging_kit/batch05a-final-ops.sh export
Rollback: no previous dedicated staging version exists. Stop runner, export/preserve evidence, remove or disable only newly created staging Worker; retain D1. If staging already exists when approval executes, record previous version and refuse unreviewed target changes.

## Next checkpoint
Await explicit user approval of the remote operations and limits above. Assemble execution on an isolated GitHub branch using immutable FINAL FIXED sources; never write main or run production workflows. Preserve execution logs and export evidence even if the smoke fails.
