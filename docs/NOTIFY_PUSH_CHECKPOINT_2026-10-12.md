# Notification checkpoint — 2026-10-12

Production code: 5ab2e6787f5643689c30abd2080fad16c97e5a5c.
Production Cloudflare version: 9e1744be-7b2c-4fc5-b755-bba6cea2d2e0 (100%).
Original rollback: 60781a4e-70cb-4c02-a036-2528c3048ed5, retained.
Frontend, TOP/EDGE, scoring formulas, thresholds and manual scan choice unchanged.

## Verified evidence
- Device preferences read directly from production: latest registered device Goal/GAP 60; older device 70; H1 72.
- Both Web Push test requests accepted by the service. User explicitly confirmed receipt on phone.
- Automatic scanning remains paused by user's choice; diagnostic did not enable scanning.
- 225 retained fixture states have STATS_UNAVAILABLE / stats EMPTY.
- Isolated strict production Statistics reads for known fixture 1576501, with and without half=true, failed API_PROVIDER_RATE_LIMIT. Three physical attempts total, maximum one start per second. HTTP 200 error payload, no quota headers, no Retry-After.
- This excludes phone transport and saved threshold as the immediate cause of missing automatic alerts. It does not prove whether the upstream block targets API key, shared IP or another provider protection.
- Audit Workers authenticated with transient credentials and deleted after use; secrets/subscriptions never exported; production version unchanged.

Evidence:
https://github.com/Phuongdien1989/-football-edge-background-watch/actions/runs/38199498071
https://github.com/Phuongdien1989/-football-edge-background-watch/actions/runs/38200309410

## Candidate correction (not yet production deployed)
Statistics and half-statistics reads now use strict error classification with inherited bounded retries. The scan loop still catches the source failure and continues. Real empty data remains EMPTY; a provider failure becomes ERROR plus a source warning, avoiding false valid-empty classification. Events/odds tolerance unchanged.
Regression: tests/test-notify-statistics-errors.mjs.
No threshold, signal gate or prediction changes.

## Remaining blocker
The production Statistics API call itself is rejected even under isolated low traffic. Need API-SPORTS to verify/unblock the key/source-IP request path, or a verified alternative outbound path. Do not assume a paid upgrade solves it, and do not bypass provider limits.
After a successful Statistics read: exercise normal manual scan, require stats OK and actual threshold crossing, then verify automatic push and dedup with fresh fixture data.
Do not claim complete from LIVE count or test push alone.
