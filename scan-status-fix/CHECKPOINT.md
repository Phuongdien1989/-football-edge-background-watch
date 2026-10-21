# Scan status recovery — 2026-10-21

Verified backend baseline: 15069125837d22f292a04bf111f0f569037793b5 / 7e4bb3b7-2dc6-4f0d-8c8a-9d8e6da2440a.
Mobile remains 3166663f-f039-48f5-92ae-888890bb9455. Desktop remains a332ee39-abb2-422d-a021-db78ef19cc10.

The 14:59 Vietnam observation showed scanner ON and cycle budget 4→5, latest provider LIVE requests successful but empty. Notification status still carried a previous cooldown failure. That proves scheduler/provider traffic, not successful HT evaluation or phone delivery.

Reproduced persistence bug: recovery to an error-free cycle was not an urgent transition, so the old error stayed until a periodic write. Periodic status interval 120 seconds also exceeded the UI's 90-second healthy threshold. New completed-cycle state is now readable from memory, recovery is persisted immediately, and durable status is checkpointed every 60 seconds. Reads never synthesize timestamps or clear a current failure. Later durable pause state wins and restart falls back to actual durable timestamps.

Only worker_notify_v130.js and worker_notify_v138_peak_window.js in the exact deployed package change. No model, score, threshold, rank, provider pacing, scan cadence, Push rule, frontend, D1 schema or history change. Budget accounting and existing alert/dedup persistence are unchanged. Stable durable status writes increase from up to one per 120 seconds to one per 60 seconds; with 720 daily cycles at 30 seconds this is up to ~360 instead of ~180 periodic status writes, plus actual failure/recovery transitions. This is a DO telemetry cost, not a D1 write.

13 targeted mocked regressions PASS locally, including reproducing the old stale failure. CI checks the immutable source package and dry-run. Production release requires exact versions/bindings, existing rollback and scanner OFF/no alarm. The workflow does not toggle scanner. If scanner is ON, the candidate and tests remain available and publication stops with SCANNER_MUST_BE_PAUSED_BEFORE_RELEASE. Re-run after the user pauses; do not assume OFF.

Open acceptance: genuine LIVE HT input, per-device gate crossing, Push service acceptance and physical iPhone receipt. Empty successful provider responses do not prove end-to-end operation. Shared decision contract remains staged, not activated. PR #6/#7 and production data remain untouched.

This patch is a scoped derivative of the exact deployed package. It is not automatically incorporated in older alternate build/release pipelines; any future rebuild must apply this patch (or equivalent reviewed integration) before replacing production.
