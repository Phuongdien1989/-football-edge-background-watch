# API-Football statistics rate-limit investigation — isolated request

Please review the server-side rate-limit decision for the request below under my signed-in API-Sports account.

- Endpoint: GET https://v3.football.api-sports.io/fixtures/statistics?fixture=1555512
- Request started: 2026-10-19T07:30:32.836Z
- Request completed: 2026-10-19T07:30:33.563Z
- Source: Cloudflare Workers (football-edge-background-watch).
- Controlled test: exactly 1 physical request, 1 logical request; no retry after rejection.
- Owner reported all Football Edge phone/browser instances closed.
- Before this request, waited from 2026-10-19T07:28:26.747Z to 2026-10-19T07:30:28.543Z, more than 120 seconds. Backend scanner OFF and no alarm. Existing backend logs show no non-health application request in that window.
- This does not independently measure any third-party traffic or other use of the API key.
- Response: HTTP 200, results/response empty; error code rateLimit.
- Exact body excerpt: {"rateLimit":"Too many requests. You have exceeded the limit of requests per minute of your subscription."}
- Quota headers: all four daily/minute limit/remaining headers absent. Retry-After absent.
- Response Date: 2026-10-19T07:30:33.000Z; CF-Cache-Status: DYNAMIC; Age absent.
- Earlier successful responses advertised 75,000 requests/day and 450/minute; do not assume those earlier headers prove the exact current account counters.
- The app now applies a global backend cooldown on this explicit subscription-minute response and does not retry rapidly.

Please confirm:
1. Which layer/counter rejected the request: API-key/subscription, source IP/network protection, or another rule?
2. The applicable limit, counter and block/cooldown expiry for this exact request/time.
3. Why HTTP 200 and absent quota headers accompany the rate-limit error.
4. Whether the restriction can be reviewed or corrected under the existing subscription before any infrastructure or paid-plan change.

Full sanitized run evidence:
https://github.com/Phuongdien1989/-football-edge-background-watch/actions/runs/39216191045

No API key is included in this repository evidence packet; identify the subscription through the signed-in support session.
