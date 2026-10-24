# Football Edge — FT V2 Step 3N: immutable exported-pair → market evidence → mobile screen
Checkpoint 2026-10-23, **Draft PR #16**, candidate-only. Does not affect app production.

## What was actually built
- `ft-v2-mobile/pair-export-bridge.mjs` accepts only bounded, locally supplied `ft_replay_pairs_v1`-shaped rows. Every row is rehashed using `verifyFTPairRow` and its underlying canonical observation/decision payloads. Tampered hash, invalid fixture, stale or future clocks, duplicates and old (>10m) snapshots are rejected/quarantined. Keeps latest valid snapshot by fixture.
- Uses existing `mapFTLiveRows` and `extractFTPricingEvidence` to check the original live O/U feed against the normalized market on exact fixture, bet id, line and both odds. Only a quote received <=60s before display survives as present-time evidence. Older matching quotes are NOT shown as current.
- IMPORTANT: a valid hash proves *internal payload consistency*, NOT the authenticity of its export or the actual bookmaker; output warns `EXPORT_ORIGIN_NOT_VERIFIED`. A matching market quote is **non-executable**, period/settlement and bookmaker identities unconfirmed.
- All real-mode outputs are `UNPRICED`, no calibrated final goal count PMF, no fair odds, EV, TOP recommendation, market automation or push. FT binary Goal Radar cannot be used to invent PMF.
- `ft-v2-mobile/inspect-export.mjs`: executable local-only CLI to load `{ "pair_rows": [...] }` JSON and write a sanitized JSON audit/report. Example:
  `node ft-v2-mobile/inspect-export.mjs exported-ft-pairs.json ft-audit-output/ft-pair-check.json`
  This does not fetch or write D1, cannot prove the original export came from production, and does not render fake recommendations.
- `ft-v2-mobile/test-pair-export-bridge.mjs`: 18 synthetic QA cases including real hash recalculation, wrong raw odds, stale/future quotes, fixture deduplication, malformed input, and CLI safe-local source.
- Both FT candidate and FT light mobile preview CI workflows now execute these tests. The old HT/HC non-regression tests plus 28-file/10-HT-asset release guard remain unchanged.

## Evidence
- Full FT candidate CI latest run: [39911541165](https://github.com/Phuongdien1989/-football-edge-background-watch/actions/runs/39911541165), SUCCESS.
- Browser preview updated run: [39911541148](https://github.com/Phuongdien1989/-football-edge-background-watch/actions/runs/39911541148), was IN PROGRESS at the initial checkpoint. Report final status after checking; previous Chrome local screenshot and existing FT bridge CI [39910079193](https://github.com/Phuongdien1989/-football-edge-background-watch/actions/runs/39910079193) PASS.
- No production deployment, no app mutation, no scanner activation, no API-Football calls, no D1 SQL.
- User's current production continues to run the existing FT mechanism, not FT V2. App Mobile HT asset recovery remains independent.

## Next hard blockers
1. Production read-only schema audit on Oct23 [39887394112](https://github.com/Phuongdien1989/-football-edge-background-watch/actions/runs/39887394112) previously found the required FT PAIR/OUTCOME replay tables **absent**. No real exported matching pairs are supplied in current thread; 3N has so far run with synthetic inputs only.
2. Need an explicitly approved, minimally-billed data collection / table creation plan *after* inspecting current real UTC D1 budget, and account-wide impact on HT/HC, API, Push and client sync. Do not activate scanner or production D1 writes until authorized.
3. Independently calibrate the full regulation FT remaining-goals model against *real* chronologically held-out results before enabling executable fair price / EV / TOP.
4. Verify bookmaker identity, exact LIVE settlement rule, market update timestamps and the mobile 28+ asset preservation contract before any production release.

**Honest status:** Offline FT source-to-UI evidence pipeline implemented; real bookmaker provenance and prediction accuracy NOT established; HT/HC preserved by no deploy.
