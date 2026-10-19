# Statistics isolation result — 2026-10-19

## Outcome
FAIL / API_PROVIDER_RATE_LIMIT after exactly ONE physical statistics request, despite the owner's confirmation that all app instances were closed and a further 121796 ms wait.

Quiet window: 2026-10-19T07:28:26.747Z to 2026-10-19T07:30:28.543Z.
Provider request: 2026-10-19T07:30:32.836Z to 2026-10-19T07:30:33.563Z.
Fixture:1555512, previously raw-verified FT fixture. This test only diagnoses endpoint access; it is not an assessment of an active match or a new prediction.

Backend logs: query COMPLETED, 4 events, no non-health application groups. Scanner OFF and alarm=null before/after.
Observation limitation: backend logs cannot measure direct requests to the provider from every possible client; the owner's closure report is the basis for foreground isolation.

Fresh error response: HTTP200, rateLimit error, no daily/minute quota headers, no Retry-After, CF cache status DYNAMIC, response Date 2026-10-19T07:30:33.000Z. The new backend correctly activated GLOBAL cooldown and sent no rapid retry. The measured physical-attempt delta is 1. Internal quota changed by a prepaid block of64; that is NOT64 physical requests.

## What this establishes
The observed rejection is not explained solely by the previously open Football Edge frontend sessions or by a burst from this controlled backend test. The endpoint still refuses access under the isolated conditions.

## What it does not establish
It does not distinguish a key/account restriction, network/source-IP protection or a provider-side counter/rule. It does not prove a dedicated IP or paid Cloudflare plan is required. Stop repeated probes and code/threshold adjustments until an outside-Worker comparison or provider log review supplies more evidence.

## Production preserved
Source da5242bb41b2401271f52dda17b0e2208e7e3819.
Version04cc044d-412f-4844-9b83-c7c786eedd13 remained at100%.
Mobile03c1d55d and Desktopa332ee39 versions unchanged.
Scanner OFF; next_alarm=null. Temporary helper deleted. No Push was sent by this test. No production D1 writes requested by this test.
Rollback versions preserved as documented in BACKEND_COMPLETION_CHECKPOINT.md.

Evidence run:
https://github.com/Phuongdien1989/-football-edge-background-watch/actions/runs/39216191045

Prepared account-specific support packet: API_SUPPORT_ISOLATED_STATISTICS.md.
No provider message was sent. No permanent production code or configuration changed in this isolation task.
