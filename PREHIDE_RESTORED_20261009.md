# User-selected pre-hide notification sync restored

This supersedes FULL_ORIGINAL_ROLLBACK_20261009.md as the active production state.
User clarified on 2026-10-09 15:22 that rollback meant the completed notification
sync release immediately BEFORE research cards were hidden, not the original
pre-sync P2052. No new product changes were deployed in this restoration.

Verified restoration:
- Frontend 9b5bb5f1-fb53-4a54-9825-b0850ea28074.
- Public source SHA256 09aaffa8791f64144072dacefa41ec7046ed313063d3c83aa28e68ee6cf3c8e1.
- Backend 491076a2-78d9-48f0-9050-ffc0f479c531 (V138 notification sync extending original V137).
- Research cards visible as before; original P2052 UI unchanged; R2 excluded.
- Frozen original versions remain frontend c1ab7df6-d13d-436c-a656-c42a547b3420
  and backend 37c473f4-f2f7-4b77-a441-fc50baf48974 for emergency rollback only.

Workflow 37904928952, job 113735990163 SUCCESS at 2026-10-09 15:27 local:
- Exact frontend source and backend schema verified.
- Actual production WebKit notification state refresh OK, one real H1/HC
  snapshot 1507451; missing stats did not create a fake score.
- Real frontend LIVE list returned 5 fixtures: 1507077,1507078,1510460,1510461,1507451.
- Real LIVE SCAN button completed with H1=0, FT=2, HC=4; no JavaScript errors.
- Physical iPhone notification click is still NOT independently verified.

First verification attempt met a second automatic focus/pageshow refresh and
asserted SYNCING prematurely. Only test timing was adjusted to wait for settled
status; production source was NOT edited. The successful retry used identical
pre-hide production versions.

Do not confuse a request to restore this completed pre-hide release with restoring
the pre-sync frozen original. Any future HC alert-time snapshot enhancement must
be additive, tested separately and must not redesign UI or modify engines.
