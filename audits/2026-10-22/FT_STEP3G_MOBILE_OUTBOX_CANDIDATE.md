# Football Edge — 3G Mobile Outbox correction candidate (2026-10-22)

**Branch:** `fix/ft-foundation-20261021`, PR #16 Draft. **OFFLINE CANDIDATE ONLY.**
**Production backend, Mobile and Desktop, scan, D1 schema, Push, TOP and HT/HC unchanged.**

## Verified actual deployed public Mobile HTML
- Live verified by [read-only public HTML inspection run 39787093164](https://github.com/Phuongdien1989/-football-edge-background-watch/actions/runs/39787093164) at 2026-10-22 13:28 UTC.
- Public GET URL: `https://shiny-silence-d892.ngophuonghuy.workers.dev/`.
- **Baseline SHA256:** `005a74b4768a00f92ac462592b3de63106b2a4db35732103f6095cfed9fdb46d`; **1,353,667 bytes**.
- Source marker observations: `feDbQueueEntryDecision` present, `feDbEntryFingerprint` absent, `feDbAckBatch` absent, OLD separate sync-state ACK/outbox deletion present. `queue_revision` matching logic is present, so this is a legacy/partial fix, not a completely unversioned Outbox.
- This proves frontend source markers, not actual queued traffic or the device's IndexedDB state.
- Authenticated Cloudflare `/content/v2` previously responded with zero source bytes; this was NOT usable verification. The public HTML GET is the grounded active frontend source. Preserve that distinction.

## New pinned no-deploy Mobile candidate
- `mobile-outbox-candidate/build_live_mobile_20261022.mjs`: applies existing **scoped**, previously staged Outbox patch on SHA-pinned actual Mobile HTML, not the obsolete `aa4f0f...` October 16 baseline.
- `ft-audit-fix/test-mobile-live-diff-scope.mjs` validates that reversing the three authorized edits reproduces **the entire original HTML byte-for-byte** by SHA, ensuring no unintended change to Card, TOP, Push, UI or other JavaScript/source.
- Candidate SHA256: `d5dd7761ea2296aab2762564457f92c778c1065f3112bba61e6cdd0a13535752`; **1,355,818 bytes**. No HTML is committed or deployed by this workstream; candidate is generated ephemerally in CI.
- Changes ONLY: (1) canonical full-payload fingerprint for ENTRY enqueue, (2) atomic IndexedDB transaction for ACK state and matching queue revision removal, (3) strict sync response whole-batch ACK before removing pending events.
- No backend Worker source changes or new D1 writes from tests.

## Final test proof
- [Final pinned Mobile offline QA — PASS](https://github.com/Phuongdien1989/-football-edge-background-watch/actions/runs/39788329255).
- Checks include duplicate payload suppression, lost-ACK retry suppression while pending, legitimate PENDING→RESOLVED and corrections retained, `0`/`false` vs `null` distinction, late ACK cannot delete newer revision, atomic ACK transaction, partial ACK refusal.
- **Exact HTML scope QA: PASS**: original fully reconstructible after reversing 3 authorized edits, `unchanged_entire_rest=true`, `unintended_ui_changes=0`.
- Intermediate workflow runs `39787902531` and `39788094008` failed due to the audit *comparison* assuming the ACK helper must follow the ENTRY function. Actual Mobile HTML positions ACK helper earlier. Updated whole-document reversal test correctly handles arbitrary function order. Final run PASS with unchanged candidate SHA and passed behavioral tests.

## Previously measured D1 pressure
- [Oct 22 read-only D1 group analysis](https://github.com/Phuongdien1989/-football-edge-background-watch/actions/runs/39753374035): `entry_decisions` about **95,632 billed rows written / 11,954 inserts** that UTC date; ~93.7% of production 102,066 rows at query time. Does not prove those writes were duplicates.
- Production baseline `worker.js` already includes duplicate-payload guard, `source_revision` ordering and RESOLVED protection; **DO NOT replace it with older PR #6**.
- The new Mobile patch targets repeated identical payloads and ACK state. It **cannot** stop truly new decision IDs or semantically changed payloads, and a full-payload fingerprint intentionally preserves such changes. It is **not a validated daily D1 savings estimate**.
- D1 Free daily write limit was exceeded earlier the same day (Cloudflare 7500). There was no D1 SQL or write in this workstream.

## Release gate
1. **Do NOT deploy or merge as part of this candidate**. No automatic background scan or account upgrade.
2. Before any separately approved *Mobile-only* release, verify actual deployed Worker version and public HTML SHA **still exactly matches pinned baseline**; stop on drift.
3. Verify precise frontend rollback artifact, deployment controls, app host and iPhone client behavior, including IndexedDB migration from legacy queued records, lost network ACK, genuine corrections, and no regressions to FT/HT/HC/TOP/Push.
4. Check production D1 usage and sample actual sender events using privacy-safe aggregate logs; quantify new unique IDs versus accidental retransmits; never erase existing entry/outcome histories.
5. Dry-run deployment packaging and obtain explicit owner approval for a **separate Mobile-only** release; backend/FT replay production deployment remains blocked.
6. Restart isolated pair D1 measurement only when Free account usage is under budget after reset with controlled authorization; FT AI V2 Tài/Xỉu fair price, EV and calibration remain a separate model stage.

## Outcome
**3G implementation/offline QA: PASS. Production release: HOLD.** Safe checkpoint saved; mobile candidate build source is ready for independent approval, not a production patch.
