# FINAL PRESTAGING — concrete checkpoint
Verified 2026-10-07 via read-only GitHub Actions, run 37634967955.
Repository: Phuongdien1989/-football-edge-background-watch
Branch: checkpoint/b05a-final-readonly-20261007

## Verified
- Existing GitHub Cloudflare credentials are available and authenticated metadata reads returned HTTP 200.
- Cloudflare workers.dev subdomain: ngophuonghuy.
- Dedicated staging Worker football-edge-b05a-staging-bridge returned HTTP 404 / code 10007 for secrets and deployments.
- D1 list returned HTTP 200; no exact staging-name match. Pagination verification is recorded in the follow-up run.
- Repository-level APISPORTS_KEY and BATCH05A3_BRIDGE_TOKEN are not available to this runner.
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

## User input that is actually needed
Add APISPORTS_KEY to this repository's Actions secrets using GitHub's secret input form.
Do not paste it into chat. Do not change/remove existing production secrets.

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

## Next preparation
After runner key becomes available, finish the concrete remote workflow against the immutable FINAL FIXED sources and present one approval checkpoint before resource mutation/provider calls.
