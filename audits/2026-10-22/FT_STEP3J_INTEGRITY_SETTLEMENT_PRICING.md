# Football Edge FT AI V2 — step 3J: Integrity, settlement and conditional pricing

**Date:** 2026-10-22 Asia/Ho_Chi_Minh. **Scope:** draft PR #16, no backend production deployment, no database mutation, scanner remains OFF.

## Completed — offline FT evidence integrity
- `ft-audit-fix/replay-integrity.mjs`: in addition to the top-level live fixture, the separately captured `sources.fixture.data` (object or list) cannot carry a future sealed fulltime score or a final match status in an earlier FT prediction snapshot. A source with normal `score.fulltime=null` stays valid; missing nonmandatory statistical data stays REVIEW, not a false losing recommendation.
- `ft-audit-fix/pair-outcome-replay.mjs`: hashed immutable pair is quarantined if the observation integrity check REJECTS; latest tied outcome revisions are all inspected (not only first). Pair and outcome remain separate immutable data.
- `ft-audit-fix/decision-trace.mjs`: `linkFTReplay` requires an actual `FT/AET/PEN` final status for full regulation settlement; canceled/abandoned matches cannot enter LINKED and are not counted as losing selections.
- `ft-audit-fix/test-replay-integrity.mjs` and `test-pair-outcome-replay.mjs`: targeted regressions on these failure paths, including source-fixture contamination hidden outside top-level fixture and false settled cancellation. Previous relevant candidate CI [39804483428 PASS](https://github.com/Phuongdien1989/-football-edge-background-watch/actions/runs/39804483428).

## New FT O/U bookmaker settlement and conditional fair-odds math
- Pure module `ft-audit-fix/ft-total-settlement.mjs` is not wired to production; it cannot place bets or write D1.
- Explicit regulation fullmatch FT Over/Under settlement only, from `finalRegulationScore.home + finalRegulationScore.away` **exactly once**. Live 1–1 progressing to 1–2 means three regulation goals for settlement at a FULL_MATCH_REGULATION line, not two new goals or five after double count.
- Asian totals exact quarter splitting: 2.25 → equal weights at 2.0 + 2.5, 2.75 → equal weights at 2.5 + 3.0. WIN, LOSS, PUSH, HALF_WIN, HALF_LOSS, including `AET/PEN` whose *regulation* score must be explicitly supplied. `CANC/ABD` etc never score automatically.
- `reviewFTTotalPrice` computes mathematical break-even decimal odds `1 + expected_losing_stake/expected_winning_stake` and conditional net EV from an **explicit complete distribution of final regulation goal totals**. It checks the model version and source/market received-at clocks against the decision time. **No inferred probabilities, no self-certified model accuracy, no automatic edge ranking and no FINAL recommendation.** It is not yet connected to the existing FT Engine forecast output or bookmaker market provenance.
- Example **synthetic only** Over 2.5 with exactly 49% chance of two goals and 51% of three goals yields fair decimal odds ≈1.96078 and +0.02 net units at decimal 2.0. No assertion this distribution applies to any real match.
- Require source-confirmed bookmaker convention before applying the FULL_MATCH_REGULATION settlement helper to any live bookmaker quote: alternative market definitions must not be silently treated as full-time totals.
- **28/28 new settlement/pricing cases PASS** within entire FT CI [39804954570 PASS](https://github.com/Phuongdien1989/-football-edge-background-watch/actions/runs/39804954570), covering quarter/half wins, pushes, regulation vs extra time, chronology, missing model and negative/incomplete probabilities.

## Remaining hard gates
1. Production still runs the current FT legacy / UI and **not FT AI V2**. PR #16 is Draft, no merge/deploy.
2. FT pair recorder/Outcome D1 **real remote** verification previously blocked by exceeded Free account rows-written quota on Oct 22 (Cloudflare error 7500); do not claim this was resolved.
3. No real scored and calibrated full-goal distribution tied to a frozen FT Observation+Decision snapshot yet; hence model-vs-bookmaker fair pricing, EV, hit rate, ROI and TOP ladder value **unverified**.
4. Production D1 2026-10-22 already over Free; scanner remains OFF. A separately scheduled one-time morning Oct 23 read-only quota/go-no-go check exists. Do not automatically activate scans based on a test being green.
5. Next scoped work: prove extraction/availability of real model probability output and same-time eligible FT bookmaker market rows; reconcile market lines/prices and settle conventions. Only after provenance and calibrated input may the candidate mathematical price be attached to replay cases. Keep missing data visible rather than inventing it.

**Summary:** Offline 3J FT integrity and settlement math PASS; real prediction accuracy and profitable opportunity acceptance NOT established; no production change.
