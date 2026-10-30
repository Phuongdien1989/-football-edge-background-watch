# Football Edge FT V2 — Production D1 legacy-source discovery, 2026-10-23

**Actual one-time Cloudflare read-only audit: 2026-10-23 06:43 UTC / 13:43 ICT.** This result supersedes the earlier schema-only probe that checked solely the new FT replay table names.

## Evidence / authoritative job
- [GitHub Actions 39913219297 — SUCCESS](https://github.com/Phuongdien1989/-football-edge-background-watch/actions/runs/39913219297), commit `94b908e4fd2d609084e96872c1c7a8f417a0be16`.
- Fresh account D1 GraphQL (adaptive/delayed, **NOT real-time billing authorization**) returned for UTC 2026-10-23: **182,440 rowsRead**, **4,646 rowsWritten**, 813 read queries, 602 write queries, reported for known production DB. Those are account/DB usage already incurred elsewhere, NOT rows written by this audit. Prior UTC Oct22 prod database analytics now listed 102,420 rowsWritten. Never assume traffic is idle or quota guaranteed because the same daily aggregate appears unchanged.
- Audit SQL: **4 SELECTs** (schema + three indexed 24-row samples), reported `rows_read=[35,24,24,24]` = **107 rows billed read**, **0 rowsWritten**, 0 provider calls, no deployments, no scanner enable.
- No match IDs or raw payloads exported or logged. No Cloudflare D1 schema updates.

## Actual legacy table presence and bounded sample audit
| Table | Exists? | Bounded FT sample | Observed columns | Constraint |
|---|---|---|---|---|
| `live_snapshots` | YES | 24 rows / 4 fixtures | 0 rows with BOTH line and price | FT pre-decision history can be partially reused; does not prove original bookmaker odds |
| `entry_decisions` | YES | 24 rows / 1 fixture | 24 with line+price AND `model_prob` field | This is **NOT** proof that `model_prob` represents a calibrated final regulation total-goal PMF. No raw price provenance established |
| `entry_outcomes` | YES | 24 rows / 3 fixtures | 24 with final_score_home/away | Final score content does NOT independently prove source of full-regulation label or correct pairing with older FT records |
| `fixture_history` | YES | NOT READ | Exact required index/column signature did not pass static discovery; deliberately skipped, not counted as empty | Requires safe schema investigation; do not use unindexed scan |
| `market_snapshots` | NOT FOUND | 0 | None | The raw book/market provenance bridge cannot be satisfied by guessing from a normalized entry price |
| `ft_replay_pairs_v1` | NOT FOUND | 0 | None | No SHA-paired new FT Observation+Decision ledger on production |
| `ft_replay_records_v1` | NOT FOUND | 0 | None | No append-only FT Outcome replay table on production |

### Sample chronology (not fixture linkage)
- Sample FT `live_snapshots`: latest 2026-10-22 22:06 ICT; oldest 2026-10-21 09:42 ICT.
- Sample FT `entry_decisions`: latest 2026-10-21 09:21 ICT.
- Sample FT `entry_outcomes`: latest 2026-10-10 18:58 ICT; older than sampled decisions. Samples DO NOT prove whether *other* older decision fixtures can link to these outcome rows.

**Conclusion: genuine FT historical data DOES exist on production**, so a blanket statement that FT has zero production data is incorrect. However, **zero pairs were independently proven** to contain matched pre-decision original odds, hash-verified Observation+Decision, regulation outcome and leak-free chronology. The experimental Poisson model remains NOT CALIBRATED and cannot create fair price/EV or TOP.

## Offline code added
- `ft-audit-fix/legacy-ft-source-plan.mjs`: explicit read-only query allowlist, indexed source plan, bounded samples, fail-closed on table/index/column drift.
- `ft-audit-fix/test-legacy-ft-source-plan.mjs`: 17/17 PASS in [candidate CI 39913057720](https://github.com/Phuongdien1989/-football-edge-background-watch/actions/runs/39913057720).
- `ft-audit-fix/legacy-ft-source-readonly.mjs` and `.github/workflows/ft-legacy-source-readonly.yml`: one-shot GitHub marker `[ft-legacy-source-once]`; strictly readonly after fresh D1 analytics, fail closed when daily budget unverifiable. Already executed once and succeeded. **Do not create an extra rerun merely to refresh metrics.**
- Production backend/HT/HC/Mobile/Push/Scanner has not been modified by this work.

## Recommended near-term continuation (NO deploy)
1. Offline investigate actual payload and source semantics in existing Worker code before adding any raw data read. Determine precisely whether `live_snapshots.payload_json` or decision payload freezes raw odds with timestamps, and how `entry_outcomes` establishes regulation score/settlement.
2. If existing payloads can be reused, create a second narrowly-scoped (small/sample, aggregate or locally redacted) read-only provenance check with proper budget and approval, and test exact fixture/time joins against independent final score. Do NOT infer pairing from aggregate sample counts.
3. Where raw original bookmaker source evidence is missing, develop a disabled-by-default **FT-only** data capture sidecar with idempotency, strict UTC Free budget and verified no extra API-Football calls. PR #16 remains DRAFT; never run D1 writes/migrations without specific deployment approval. Existing UI FT legacy watch can remain read-only meanwhile.
4. Build real chronological training/holdout cohort only from fully verified pairs and compare FT total-goals Poisson baseline against real regulation outcomes and calibration. Do not reuse `model_prob` from legacy decision as the new FT total-goals PMF without contract analysis.
5. Enforce 28-file Mobile assets (10 HT pricing), HT/HC/TOP/Push regression, and independent rollback before any future FT V2 production release.

**Status: LEGACY_FT_SAMPLES_FOUND_UNVERIFIED.** Better availability than expected, but no claim of real predictive edge or release eligibility.
