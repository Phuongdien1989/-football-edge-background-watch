# Central ENTRY measurement — 18 October 2026 checkpoint

## Status
Candidate based on actual deployed backend commit 3c97629e51251c56f9edeb8d0f67a7a0dad957a2.
Branch: fix/central-entry-measurement-20261018.
No production Worker source, frontend, wrangler config, PR #6/#7, scanner settings or existing database rows were modified.
No new production route or production ledger table has been installed.

## Implemented
- Central collection reads the complete D1 cohort, not a phone's capped 2,600-record local list.
- Primary comparison selects the first captured observation per fixture/engine before checking outcomes.
- H1/FT period-score validation rejects nulls, wrong fixture/status, unsupported markets, future entry vs older evidence and conflicting source scores.
- Exact quarter-line, push and half-win/half-loss arithmetic; true zero remains valid.
- Classification is PAPER_RESOLVED or UNKNOWN. Bookmaker result verified is always false; whole-period basis remains an explicit assumption.
- Append-only fe_entry_measurements ledger tested on staging DB 7d503048-9118-4b29-b662-4e1ba6e32167.
- Content-addressed results do not rewrite records when the same evidence is replayed. Later valid/conflicting evidence creates another version, preserving previous results.
- Provider refresh is explicit, disabled on pushes; it uses the existing Durable Object API method and its quota/pacing. It does not activate the scanner.
- Provider helper is authenticated, ephemeral and deleted in finally. Later code preserves every completed batch and supports FE_RESUME_SOURCES_PATH.

## Verified results
First successful staging run:
https://github.com/Phuongdien1989/-football-edge-background-watch/actions/runs/39116689134
145 global samples, 290 D1 rows written on initial ledger inserts; 0 on repeat. Three lifecycle records added 9 D1 row writes. Production D1 writes: 0.

Latest candidate QA:
https://github.com/Phuongdien1989/-football-edge-background-watch/actions/runs/39117182246
PASS, source cd19eb6e115b3ec368915039f4a70a9c4bebe13e.
Existing cohort and lifecycle replay both wrote 0 staging rows. Production versions unchanged.

| Engine | Global fixture samples | Resolved paper | Unknown | Paper units |
| --- | ---: | ---: | ---: | ---: |
| FT | 64 | 7 | 57 | -1.275 |
| H1 | 81 | 22 | 59 | +8.9 |

Incomplete, correlated, observational samples do not prove betting profitability. Historical H1 profit is concentrated in two high-price samples, as documented in the earlier audit.

## Actual blocker: independent provider verification
Run https://github.com/Phuongdien1989/-football-edge-background-watch/actions/runs/39117009024
The staging step PASSED. The provider verification step FAILED with API_PROVIDER_RATE_LIMIT on logical batch 2.
There were 145 entry samples for 124 unique fixture IDs. The first batch returned 19 FT and 1 PEN status; the next request was rejected.
The temporary helper was successfully deleted. Existing production deployments were not redeployed.
The failed run's original script did not persist detailed first-batch rows before the error; no new ROI is claimed from those responses. This checkpointing gap is corrected in cd19eb6. It has not been re-exercised against the provider because automatic refresh is now disabled after the rate-limit stop.

The provider permits batches of up to 20 fixture IDs:
https://www.api-football.com/news/post/how-to-get-all-fixtures-data-from-one-league
The cap is on logical batches, not a claim about physical retry attempts within the inherited API client.

## Continue without redoing completed work
- Reuse the PASSed core and staging ledger. Do not change forecasting thresholds based on these paper numbers.
- On a separately authorized explicit provider refresh after availability/cooldown is confirmed, resume saved sources when available. No unbounded retry loop.
- Keep raw evidence provenance and UNKNOWN states. Do not turn missing scores into zero or losses.
- Independent final-score completion and bookmaker line/basis verification remain outstanding.
- Production integration has not been released. Preserve mobile 03c1d55d-358a-448b-96f3-f356704831df and backend 2be01a61-cc5d-43c7-9c6d-13e581296453.
