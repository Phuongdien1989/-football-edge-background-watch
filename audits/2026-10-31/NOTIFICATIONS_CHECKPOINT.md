# Football Edge — Notification release checkpoint, 31 October 2026

Production notification integration is deployed. Physical phone display and a
real qualifying fixture-to-phone recommendation remain unverified.

- PR #33: https://github.com/Phuongdien1989/-football-edge-background-watch/pull/33
- Deployed source: `7c22543d019cbec05026974b0f3e43df39ee44a1`.
- Release PASS: https://github.com/Phuongdien1989/-football-edge-background-watch/actions/runs/41154041190
- Backend 100%: `fcf19574-3498-4ef3-9d08-d9fb575df365`.
- Mobile 100%: `611a74b2-2a1d-43fc-80ae-1c2b920e6df9`.
- App: https://shiny-silence-d892.ngophuonghuy.workers.dev/
- Release evidence artifact: `13024591630`; preceding-source backup: `13024001783`.
- Desktop unchanged: `a332ee39-abb2-422d-a021-db78ef19cc10`.

## What is running

HT, FT Overview and FT AI V2 share the existing card pricing models and matching
source observations with the background notification evaluator. Independent
per-device toggles are available. No model formula, ranking, TOP/EDGE, scan
cadence, historical data, database schema or provider policy was changed.

HT/FT priced alerts require a valid native trial-entry decision, fresh data and
quote, and positive expected value. A high probability alone is not an entry.
Legacy Goal FT and HC GAP retain their device-specific thresholds and are
labelled signals, not priced-entry recommendations. HC research does not yet
have a verified selected-side entry/settlement policy; no HC priced-entry Push
is claimed or fabricated.

Same-device/same-fixture mechanisms are grouped, with durable reservation,
five-minute hold, restart protection and stable tags. Uncertain delivery cannot
be described as exactly-once physical delivery.

## Verified in this release

- Candidate backend and all 54 Mobile assets were byte-identical to previously
  PASS tested modules; model/browser candidate checks were reused.
- Both complete Wrangler dry-runs PASS.
- Actual production object reports FE_MECHANISM_NOTIFICATIONS_V1 and source7c22543d.
- Published app browser acceptance PASS at 320/375/390/1280px; preference checks
  PASS at 320/390/1280px. These are controlled UI scenarios, not proof of live
  model accuracy or a real qualifying recommendation.
- All 54 public asset hashes match; 50 baseline assets remain unchanged.
- One logical real LIVE query succeeded: 21 fixtures, HTTP200/codeOK. Observed
  API headers: 75,000 daily limit, 73,906 remaining; 450 per minute, 418 remaining.
- One test Push sent to the unique enabled Apple subscription was accepted by
  the Push service. On-phone display still requires user observation.
- Temporary helper and diagnostic Tail deleted; no permanent cron/log tail.
- Scanner remains OFF, manualEnabled=false, next_alarm=null. Do not automatically
  turn it on; the user explicitly chooses when to scan.

Two enabled devices retain different Goal/GAP settings (70/70 and60/60). The
sanitized report intentionally does not map identifiers to devices. Do not infer
which setting belongs to the phone. The user can review/save that phone's prefs
in the app's notification controls.

## Deployment blocker resolved

The existing football-edge-global Durable Object retained old code while a new
object in the same namespace ran the new code. A short-lived Cloudflare Tail
software refresh made the original object load the new source without changing
its ID, namespace or storage. The release uses this verified refresh on deploy
and rollback. Its native socket is closed and Tail deleted before explicit
process exit, avoiding a retained Node event loop.

Diagnostic run41153422032 has a CANCELLED workflow conclusion: its result and
cleanup completed successfully at01:03:40UTC, but the process retained a socket
until timeout. It is not reported as a PASS workflow. The succeeding complete
release41154041190 passed all steps.

## Rollback and remaining work

Compatible immutable backend rollback: `880db53d-aa17-4aed-9350-aa78e44edd56`,
exact preserved source `3cd210d2d74aff547de4587ab4a3c96b982a728c`.
Compatible immutable Mobile rollback: `1490e52a-bd7b-4490-a717-2f50425f1f69`,
exact preceding54-asset app. Original Mobile versionc9b86303 is preserved.
The original backend UUIDe7d2090c was previously rejected by Cloudflare10210;
use the verified compatible immutable version, not its readable metadata alone.
D1, DO namespace, subscriptions, VAPID and histories were preserved.

Still open:
1. User checks whether test title “Football Edge · Kiểm tra thông báo” appeared.
2. User refreshes the installed app, reviews/saves desired per-mechanism prefs,
   and manually enables scanning when ready.
3. Observe a real qualifying HT/FT/HC-signal event end to end, including displayed
   quote/context and dedup. Do not claim real recommendation delivery yet.
4. Prior intermittent statistics/odds rate-limit/cooldown errors are not proven
   permanently resolved by one successful LIVE query. If they recur, investigate
   exact physical request timing and returned headers rather than assuming the
   daily quota is exhausted or requiring an infrastructure upgrade.
5. Real24-hour D1/DO usage and model predictive performance are not certified.

Keep Cloudflare Free. Do not re-run unchanged PASS suites or overwrite old data.
