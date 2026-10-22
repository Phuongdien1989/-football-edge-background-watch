# Football Edge — D1 recovery and Mobile-only release gate (2026-10-22)

## Verified live condition
- Read-only Cloudflare D1 analytics at 2026-10-22 13:47 UTC: **102,094 account-level rows written**, of which **102,066 production**, **28 isolated FT**. Free allowance 100,000/day, excess 2,094. [Evidence run](https://github.com/Phuongdien1989/-football-edge-background-watch/actions/runs/39789946380).
- The same calendar day, Cloudflare D1 remote write attempt failed with HTTP 400, code 7500: daily write quota exceeded. **Do not use estimates/analytics as proof that writing is restored.**
- Latest read-only backend health checkpoint: scanner OFF, manual OFF, no alarm; current state must be checked again before a later release.
- Production backend source SHA/commit: `3cd210d2d74aff547de4587ab4a3c96b982a728c`; backend already has duplicate-payload, source_revision and RESOLVED guards. **Do not replace with old PR #6.**

## Completed Mobile remedy (OFFLINE ONLY)
- SHA-pinned Mobile production public HTML: `005a74b4768a00f92ac462592b3de63106b2a4db35732103f6095cfed9fdb46d`.
- SHA-pinned patched Mobile candidate: `d5dd7761ea2296aab2762564457f92c778c1065f3112bba61e6cdd0a13535752`.
- Candidate added canonical ENTRY fingerprint, atomic IndexedDB ACK and strict complete-server-ACK checks. All Mobile function, shared ACK, exact HTML scope and FT candidate regression tests passed in [final QA](https://github.com/Phuongdien1989/-football-edge-background-watch/actions/runs/39788931079).
- Exact rollback+candiate ZIP [GitHub artifact 12430666044](https://github.com/Phuongdien1989/-football-edge-background-watch/actions/runs/39788931079/artifacts/12430666044).
- No Mobile production deployment; no D1 writes; scanner not enabled.

## Mandatory safe release sequence (separate explicit approval)
1. **At the next relevant inspection after 00:00 UTC daily reset**, read-only verify D1 usage and scanner health again. Do not infer that scanning is safe from the calendar alone.
2. Before any Mobile-only deploy, read-only validate Mobile active Worker ID and public HTML SHA equals the pinned SHA. STOP if drift, because a different app version would make this patch invalid.
3. Validate exact rollback original HTML and Worker version; ensure same hostname, routing and build method. Do not deploy backend, FT AI V2 collector, or alter D1 schema.
4. Only with **separate explicit release approval** deploy the isolated Mobile candidate; run a narrow smoke test on iPhone, verify IndexedDB legacy pending-event migration, no stuck outbox, no repeated POST flood and no TOP/Push/HT/HC regression.
5. Before any scanner ON, confirm usage is within Free quota, count baseline `entry_decisions` new IDs/revisions and compare the same post-deploy period. Only short manually approved scans after budget controls confirm safe headroom; default scanner remains OFF.
6. Rollback Mobile from the exact SHA-pinned original if UI/sync errors occur; never discard queued decisions or wipe IndexedDB to force success.
7. FT AI V2 replay remains Draft and its paired D1 measurement blocked pending separate isolated permission and D1 headroom.

## Release gate (2026-10-22)
- Offline code and QA: **PASS**
- Cloudflare Free account-write gate: **FAIL** (102094 > 100000 and HTTP 7500 observed)
- Proven current iPhone behavior: **UNKNOWN**
- Production Mobile-only deployment: **NOT APPROVED / NOT EXECUTED**
- Production scanner: **DO NOT ENABLE**
- Explicit next owner decision: separately approve a small Mobile-only release after latest no-write preflight.
