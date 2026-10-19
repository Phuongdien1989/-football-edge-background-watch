# Football Edge — checkpoint 2026-10-19

## Verified diagnostic cause
Production namespace a401c5da72a54ec1ba485db1b46d89c9 belongs to football-edge-background-watch / BackgroundWatcher. D1 binding remains 0d12a7cc-12a9-4c71-b55b-61dfd2dac4d4. Both uploaded code and local dry-run bundle contain error_detail and export BackgroundWatcher13 as BackgroundWatcher.

Historical Workers logs from 2026-10-18 10:19:30–10:25:30 UTC show 47 EDGE events on version 0ce2f6fb but all 91 recorded DO events on original version 2be01a61. During the second diagnostic attempt, the new EDGE version handled requests from 10:23:02.936 to 10:24:19.258 UTC while DO peak-window requests still used the old version. Therefore the missing field was a version-observation mismatch, not proof of an incorrect namespace or missing bundled code. Eventual rollout convergence is consistent with Cloudflare's documented code-update behavior; the historical reason it exceeded that attempt's short window is not separately proven.

Official reference: https://developers.cloudflare.com/durable-objects/platform/known-issues/#code-updates

Read-only routing/log audit PASS:
https://github.com/Phuongdien1989/-football-edge-background-watch/actions/runs/39182573498

## Stored provider error successfully retrieved
Guarded existing-version observation run 39182446057 attempt 2 PASS. It verified settings and scanner OFF/no alarm, temporarily promoted already tested diagnostic version 0ce2f6fb, observed the new field after 10.929 seconds, read stored evidence, and restored exact original backend. No football provider calls were requested by this diagnostic job.

Provider body: {"rateLimit":"Too many requests. You have exceeded the limit of requests per minute of your subscription."}
Failed observation: HTTP 200; daily/minute quota headers absent; request_kind OTHER_ENDPOINT; response_count 0. Nearby successful observation advertised 75,000/day and 450/minute, with 53,861/day and 449/minute remaining. These are stored observations, not a current whole-account measurement.

The body identifies a per-minute rejection but does NOT establish whether aggregate client traffic, source network handling or another provider mechanism caused it. It does not identify an IP restriction. Do not recommend a paid Cloudflare plan from this evidence.

https://github.com/Phuongdien1989/-football-edge-background-watch/actions/runs/39182446057/attempts/2

## OFF alarm registration bug isolated
Recent existing logs contain three backend POST /api/watch/register calls and two DO alarms during the 00:47:44–00:50:44 UTC window. Scanner was OFF; internal API quota remained 0. The base ensureAlarm method does not consult scanControl, so registration can schedule a wake while OFF. The full-pause alarm handler prevents background polling and does not reschedule. A pending alarm therefore does not itself prove provider requests occurred.

PR #11, commit 96c42c6c34cb981ebef029559bf2b29665a4603d, adds an OFF guard to ensureAlarm in the full-pause layer. Regression reproduces baseline bug with actual base method; checks no OFF alarm writes, ON behavior, Evidence and idempotency. Dedicated regression and Wrangler dry-run PASS, run 39182880224. No deployment. Direct notification subscription/settings alarm paths are outside this small patch and remain a separate review item.

## Final production state after diagnostic observation
Backend restored to 2be01a61-cc5d-43c7-9c6d-13e581296453, source 3c97629e51251c56f9edeb8d0f67a7a0dad957a2. Mobile 03c1d55d and Desktop a332ee39 were verified unchanged. Scanner OFF. Cloudflare plan unchanged. No permanent diagnostic or pause fix release, no engine/UI/threshold change.

## Measurement continuation
PR #9 still holds central measurement staging-only and two saved raw final fixtures. Workflow source a0121e66096fd4290d48742b955e2a8a4f2a1f1b resumes remaining fixtures on 2026-10-19, skipping saved completed samples and stopping on the first unhandled provider failure. Record its actual outcome before making any profitability claim.
