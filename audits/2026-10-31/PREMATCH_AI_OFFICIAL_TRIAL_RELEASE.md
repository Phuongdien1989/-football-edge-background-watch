# PRE-MATCH AI — official Mobile trial release

31 October2026. User explicitly authorized putting the approved prototype into
the official app for trial. No other release/merge authorization is inferred.

- Tested/deployed source:28ab30d322b207fd572da710b400de9e151da622.
- Release branch:release/prematch-ai-v1-trial-20261031.
- PR35:https://github.com/Phuongdien1989/-football-edge-background-watch/pull/35 (DRAFT, not merged).
- Workflow PASS:https://github.com/Phuongdien1989/-football-edge-background-watch/actions/runs/41166325361
- Mobile100% version:33ab421a-eb8a-4f06-8e4b-2ce6a262b70c.
- Direct tab:https://shiny-silence-d892.ngophuonghuy.workers.dev/#fe-tabs/prematch
- Immediate verified preceding Mobile rollback:611a74b2-2a1d-43fc-80ae-1c2b920e6df9.
- Backend remainsfcf19574/source7c22543d. Desktop remainsa332ee39.

## What changed and was verified

Only index.html and ui-tabs/integrated.mjs changed among the54 previous public
assets;52 remained byte-identical. Added isolated PRE modules, worker, data bridge
and seed snapshot, for68 total public assets. All published hashes verified.
The seventh PRE-MATCH tab is in the native tab router. Six existing tabs and
Overview ranking remain as before; no PRE prior was injected into LIVE models.
Production has no LAB button/data. `lab.mjs` is a disabled stub in the package.

21 pure model/evidence test groups and3,724 payout cases PASS. Cache adapter and
explicit quote confirmation tests PASS. PRE candidate/published browser checks
PASS at320/390/1440px. Existing HT/FT/HC card/session/quote tests and native scan
controls PASS on the candidate package. The copied test's tab-count expectation
alone changed from6 to7, as required by the added tab; model assertions unchanged.

Backend source7c22543d and scanner enabled=true/control_updated1793418486020
were identical before/after. No backend deployment, scanner toggle, Push,
provider calls, D1 writes or schema changes were requested by this release.

## Actual data availability and limitations

The bounded D1 snapshot read7 rows in metadata and produced0 usable trained
artifacts and0 upcoming fixtures for this feature. It did NOT produce a real
opponent-adjusted trained artifact. Do not describe the deployed trial as having
trained such a model on production data.

Instead, the official tab can read already captured DEEP bundles and existing
local API-cache history through a read-only bridge. It reuses the existing
HC-team Gamma-Poisson mathematical model at PRE/minute0 for an FT forecast,
explicitly labelled LIMITED_RECENT_HISTORY, not opponent-adjusted or calibrated.
This is a separate PRE fallback, not a modification to the HC LIVE engine.
Its forecast stays independent of odds. Missing true HT history leaves HT empty;
there is no invented HT forecast, shots, pressing or xG.

A fixture must be before kickoff and have genuine historical results in existing
PRE/DEEP/cache to show this limited forecast. Empty data shows a clear wait state
and a link to the existing fixture list. Existing PRE/DEEP actions remain the
user's way to acquire data; mounting/revisiting the new tab adds no football API
requests. The release itself did not inspect the user's phone cache or prove a
real recommendation on that phone. That remains part of trial observation.

Odds are read from existing PRE/DEEP. Scope/price are initially unconfirmed.
A user can explicitly confirm the period, regulation basis and prices after
checking the market table; confirmation is local, at most5 minutes, before
kickoff. It does not place a bet. No quote is fabricated and price changes must
be re-read/confirmed. Without this, WAIT_RULE/WAIT_PRICE is expected.

The fallback has no independently fitted alternative model. Its sensitivity
min/max can coincide; this is NOT zero uncertainty or a confidence interval.
No real forecast accuracy, calibration, ROI/CLV or investment performance is
certified. Advanced player/tactical effects remain unquantified.

## Continue

User refreshes/reopens app and selects PRE-MATCH AI. Select a future fixture and
use the existing PRE/DEEP tool normally; then read existing data in the new tab.
If source/cache/history is missing, report exactly that reason instead of adding
provider calls or showing LAB. Next work is observing real-input forecasts,
quote parsing and local evidence, then improving coverage/model artifacts under
an explicit acquisition budget if needed.

Do not rerun unchanged PASS suites. Keep old source/rollback. PR34 remains the
isolated prototype; PR35 records the authorized official trial release. Neither
was merged in this task. Do not automatically enable PRE Push or a new scanner.

Earlier attempts41165827220 (missing browser test file) and41166128389 (old
six-tab expectation) failed before any deployment. The succeeding final run
above supersedes them.
