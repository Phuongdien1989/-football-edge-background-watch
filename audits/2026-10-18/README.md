# Football Edge — OPEN outcome audit, 18 October 2026

Read-only investigation. No production deployment, data writes, scanner commands, provider requests or threshold changes.

## Findings
- FT: 4,583 observations, 64 fixtures, 4,544 OPEN. H1: 9,556 observations, 81 fixtures, 9,504 OPEN.
- fixture_history has only 2 fixtures, neither matching these entries. Catalog-only reconciliation therefore fails.
- Existing background/evidence storage contains 443 relevant raw snapshots for 28 fixtures; these partially recover missing outcomes.
- Frontend ENTRY settlement reads evRead() local storage, capped at 2,600 records, via explicit refresh/bridge. It does not settle the complete D1 history.
- Collapsing identical fixture/engine/policy/market/selection/line/price/minute/score observations reduces FT to 355 and H1 to 532. This is an analytical grouping, not permission to delete records.

## Offline paper comparison
Take earliest observation per fixture/engine BEFORE checking result availability, 1 unit each. Missing outcomes stay missing.

| Engine | Recoverable fixtures / all | Positive | Negative | Paper units | ROI on recoverable subset |
| --- | ---: | ---: | ---: | ---: | ---: |
| FT | 7 / 64 | 3 | 4 | -1.275 | -18.214% |
| H1 | 22 / 81 | 10 | 12 | +8.9 | +40.455% |

H1 concentration: two wins at decimal 5.5 and 6.0, recorded minute 45, contribute +9.5 units. Other 20 samples total -0.6. This sensitivity check does not define a new odds/minute rule.

There are 219 FT and 1,739 H1 currently-OPEN correlated observations computable from stored sources under paper assumptions. None were updated in D1.

The initial suggestion to prioritize FT from signal accuracy is not supported as a profitability conclusion by this deeper reconstruction. Positive H1 evidence remains incomplete, concentrated and small.

## Limits
- These are CAUTION/WAIT_CONFIRM paper observations, not SUITABLE approved bets.
- Scores come from existing raw sources, not an independent fresh provider check.
- Require matching raw fixture ID/status, numeric consistent period scores, final evidence after entry, valid decimal odds and quarter lines. Missing/conflicting data never becomes zero or a loss.
- Assumes whole-period OU_H1/OU_FT, matching current frontend. Executable bookmaker line, price freshness and remaining-goals settlement basis are not proven.
- Repeated observations and H1/FT on the same fixture are correlated. Unresolved coverage prevents extrapolating ROI to the complete history.
- Keep selection logic frozen; repair shared auditable outcome reconciliation and collect fresh forward samples before strategy changes.

## Evidence and reproduction
- Catalog attempt: https://github.com/Phuongdien1989/-football-edge-background-watch/actions/runs/39110516359
  Artifact 12129902755: football-edge-reconciliation-rows.json.
- Coverage diagnosis: https://github.com/Phuongdien1989/-football-edge-background-watch/actions/runs/39110651045
- Raw sources: https://github.com/Phuongdien1989/-football-edge-background-watch/actions/runs/39110837917
  Artifact 12129668863: football-edge-terminal-source-rows.json.
- Run: python3 .github/scripts/offline-paper-reconcile.py ENTRY_ROWS.json SOURCE_ROWS.json
- Summary and recovered first-observation details are committed in this directory. Original production rows remain unchanged.
