# Football Edge — FT AI V2 real source discovery, verified 2026-10-23

## Read-only production evidence obtained today
- [Legacy schema + indexed FT data source audit](https://github.com/Phuongdien1989/-football-edge-background-watch/actions/runs/39913219297): SUCCESS at 2026-10-23 06:43 UTC / 13:43 ICT. Four indexed/schema SELECT calls, **107 billed rowsRead, zero rowsWritten**.
  - Production `live_snapshots`: 24 FT sample rows, four fixtures; zero rows with BOTH legacy top-level line and price.
  - `entry_decisions`: 24 FT sample rows, one fixture; all with top-level line, price, model_prob; **model_prob has NOT been established as a regulation final total-goals PMF**.
  - `entry_outcomes`: 24 FT rows, three fixtures, all showing final score columns, historical around Oct10. Not matched to the sampled Oct21 decision rows; no proven 3L paired training records.
  - `fixture_history`: table exists; required indexed column/signature test failed, sample was deliberately not read. Exact cause of drift not determined.
  - `market_snapshots`, `ft_replay_pairs_v1` and `ft_replay_records_v1`: absent in sampled production schema metadata.
  - Cloudflare sampled/delayed adaptive UTC Oct23 production D1 analytics: 182,440 rowsRead / 4,646 rowsWritten. This is **NOT a guarantee of remaining hard D1 Free billing capacity**. These historical account writes were not created by FT source audits.
- [FT `engine='FT'` payload JSON presence audit](https://github.com/Phuongdien1989/-football-edge-background-watch/actions/runs/39914496813): SUCCESS at 06:55 UTC, one indexed SELECT on 24 bounded FT rows, **24 billed rowsRead, zero rowsWritten**; no recent raw odds groups, team-stat groups, event groups or provider-update keys in those 24 payloads. All 24 source kind OTHER; these samples need not represent other engine/source types.
- [FT BACKGROUND indexed persistence-reason audit](https://github.com/Phuongdien1989/-football-edge-background-watch/actions/runs/39914877315): SUCCESS at 06:59 UTC. Index check + 3 bounded 24-row SELECTs, **100 billed rowsRead, zero rowsWritten**, checking 24 `MARKET_MOVE`, 24 `BACKGROUND_BASELINE`, 24 `PERIODIC_5M` snapshots. In all 72 sampled rows: zero `odds_raw` groups, zero `stats_raw` two-team groups, zero `events_raw` groups and zero provider-update fields. `BACKGROUND_BASELINE` 24/24 rows had `source='BACKGROUND'`; other two sample groups had source other than BACKGROUND.
- **Total across three one-shot D1 audits:** 9 SELECT queries, 231 reported rowsRead, 0 reported rowsWritten, 0 API-Football calls, 0 Worker deployments, 0 scanner actions. Results are explicitly bounded samples, not a full corpus-wide absence proof.

## Why code support is NOT data-provenance proof
- The current repository `worker.js` `persistBackgroundLiveSnapshot` CAN serialize `payload:{fixture,stats_raw,events_raw,odds_raw}` for background snapshots. `compactOdds()` retains bet name/ID, quote values, per-market update if available, but doesn't independently establish bookmaker identity or fullmatch settlement convention.
- Actual FT and BACKGROUND bounded samples did **not** contain nonempty `odds_raw` groups. Do not assume raw markets are stored just because the writer has a field for them.
- Existing `entry_decisions` records use **`INSERT ... ON CONFLICT(id) DO UPDATE`**; their score/price/model_prob/payload can be revised without immutable predecision source evidence. Without source chronology independent from resolution, they must not certify chronological training even if some `entry_outcomes.decision_id` matches later.
- Even if legacy final scores are present, model accuracy and EV remain unvalidated until independent regulation results are linked to immutable snapshots. A stored `model_prob` scalar or Goal Radar binary `goal_ft` cannot substitute for a calibrated final-goal distribution.

## Ready code / test safety on draft PR #16
- `ft-audit-fix/legacy-ft-source-plan.mjs` + test 17/17 PASS: index-backed and SQL allowlisted legacy audit.
- `ft-audit-fix/legacy-ft-payload-shape.mjs` + test 10/10 PASS: indexed JSON odds presence, no data export.
- `ft-audit-fix/legacy-ft-background-shape.mjs` + test 9/9 PASS: BACKGROUND indexed persistence-reason presence, zero payload export.
- All three production workflows only execute on a designated first-attempt commit marker, after reading fresh UTC-day Cloudflare analytics. They ran SUCCESS once. Do **not** rerun without a new justified scope.
- Legacy HT/HC & FT V2 UI regression and static Mobile 28-asset/10-HT-asset guard are unchanged; draft branch changes have **not** deployed to production.

## Decision and minimum next step
1. **Do NOT add more optimistic price calculations or market thresholds.** The limiting factor is absence of proven raw odds + immutable matched labels in the actual sampled production dataset.
2. Prefer an **isolated FT recorder sidecar, default OFF**, piggybacking ONLY on API responses already fetched for existing scans. The candidate collector and pairing mechanism exist in PR #16. It needs a separately approved D1 schema/binding and manually bounded pilot. No automatically scheduled background scan, no additional API-Football requests, no HT/HC state resets and no unapproved production changes.
3. Pilot design: one clearly identified FT Observation+Decision PAIR per eligible supervised fixture/time, then one confirmed independent regulation Outcome after fulltime; no per-minute duplicate writes. Measure actual Cloudflare billed D1 rowsWritten (including index writes), not SQL statement counts. Stop on unexplained costs or missing original market evidence. A separate isolated database does **not** bypass account-wide Free quota.
4. User must explicitly authorize the **production schema installation and tiny real-scan data capture** before enabling it. Until then continue offline test/review only; scanner stays OFF.
5. Once enough real paired fixtures exist, train/validate the 3L remaining-goals model using genuine chronological holdouts, then qualify fair odds and EV and attach to already implemented light FT Mobile. Real bookmaker/period settlement must be verified before FINAL picks.

**Summary:** Historic FT data exists, but the actual bounded production tests found zero reusable complete FT pricing-provenance pairs. No production changes performed. FT V2 real price and EV remain blocked pending deliberately controlled capture and validation, not additional UI code.
