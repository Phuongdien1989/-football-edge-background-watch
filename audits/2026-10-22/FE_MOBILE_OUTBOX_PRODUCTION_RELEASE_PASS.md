# Football Edge Mobile Outbox — Production release confirmed (2026-10-22)

**Release PASS** via owner-authorized Mobile-only GitHub Actions [run 39791743265](https://github.com/Phuongdien1989/-football-edge-background-watch/actions/runs/39791743265), commit `8935c4dfa937fedc3fc9c44dff5962c4e04996b8`.

- Target Mobile Worker: `shiny-silence-d892`.
- Before: `3166663f-f039-48f5-92ae-888890bb9455` (**rollback version preserved**).
- After: `e1beb5bf-3617-4c54-805a-623cfafd7411` (**new production Mobile 100%** as reported by deployed active-version verification).
- Old public index SHA256: `005a74b4768a00f92ac462592b3de63106b2a4db35732103f6095cfed9fdb46d`; candidate public index SHA256: `d5dd7761ea2296aab2762564457f92c778c1065f3112bba61e6cdd0a13535752`.
- Strict source comparison: changes only ENTRY_QUEUE, ATOMIC_ACK_INSERTION and SYNC_ACK_CALL; exactly reconstructed original HTML SHA when reversing those edits. User-facing UI, FT/HT/HC, TOP, Push were not intentionally altered.
- Preflight version and asset-binding verification PASS; `wrangler@4 deploy --dry-run` PASS, then actual Wrangler Mobile-only deploy PASS.
- 18 of 18 public assets checked by digest after deploy, including index and 17 preserved auxiliary files. Wrangler transferred one changed file and reused 17 unchanged assets.
- QA: original IndexedDB duplicate/lost ACK/late ACK/RESOLVED/0-null tests PASS. Additional shared LIVE/ENTRY/QSIG ACK 5/5 PASS.
- Backend Worker was NOT deployed. No D1 SQL was called during release. Scanner state was not changed by the release.
- **Do not assume D1 Free account quota recovered:** [last read-only D1 report](https://github.com/Phuongdien1989/-football-edge-background-watch/actions/runs/39789946380) shows 102,094 billed/analytics rows written on 2026-10-22 vs Free cap 100,000. Previous Cloudflare query error 7500. No scan enablement authorization given by this release.
- Live iPhone smoke, IndexedDB migration in actual device, actual D1 row savings, push delivery and model accuracy remain **NOT YET VERIFIED**. Avoid telling owner it is safe to scan until Free daily budget recovers and app D1 usage is re-measured. Do not wipe local data.
- PR #16 can remain OPEN/DRAFT. This release was driven by a separately scoped, owner-approved Mobile-only workflow; this is NOT approval to merge PR #16 or deploy FT AI V2.

Previous tries failed safely before deploy during preflight (YAML syntax, Cloudflare GET or directory-index URL); `39791734037` failed before deployment on transient GET. Only final `39791743265` made the successful production upload.

**Recommended next acceptance:** On iPhone, reopen/reload Football Edge once (don't clear storage), inspect Mobile cards and synced status. Separately, after UTC midnight quota reset, check account D1 usage and perform a carefully budgeted user-authorized short scan if D1 write headroom is confirmed.
