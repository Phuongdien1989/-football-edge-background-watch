# FT OVERVIEW — isolated research candidate

## Owner-authorized main-app trial (19 October, evening)

The owner explicitly authorized the main-app card and experimental recommendations
while observing outcomes. The main HTML opts in with `data-fo-trial="true"`.
No calibrated-model claim is made. The independent recent-rate/time-only baseline
can issue `TRIAL_OVER` when the current matched full-time quote has positive model
EV; otherwise it waits. Missing/stale/error/cooldown input still blocks. DEMO and
archive remain non-recommending. Original HT/FT/HC and their TOP/Push stay intact.

In trial mode only, Overview TOP prioritizes positive estimated EV, then estimated
EV within the fully priced/modelled group, with stable ties and unique fixtures.
This experimental ordering is logged with policy `FT_OVERVIEW_TRIAL_EV_V1`; it is
not validated investment performance. No bookmaker-agreement cutoff or arbitrary
minimum EV margin is added. Quotes and current goals use the same settlement math.

Earlier notes below describe prior shadow-only checkpoints. They do not override
the owner's later authorization. `/original/` retains the old Mobile view, and the
immediate rollback version is `ac8c0da2-551c-4561-a554-efd4c09339ad`.

This additive candidate preserves the original Mobile SHA256
`aa4f0f6318cd52c14ff62b195c5ea04c5267107455924da44c9aa78169fe7f28`.
No HT/FT/HC scoring, threshold, TOP, Push, backend, D1, scanner or deployment
configuration is changed. `build-integration.mjs` verifies the exact baseline,
adds a whitelist read bridge with observation times in a WeakMap, a new card and
module includes, and verifies removing those additions reconstructs the baseline.

## Run and build

`node ft-overview/test.mjs`

`node ft-overview/build-integration.mjs PATH_TO_PINNED_ORIGINAL_HTML`

Serve the repository over HTTP. `/ft-overview/` is explicitly fictional DEMO.
`/ft-overview/build/` is the original app with the additive card; it uses the
existing app's read bridges and data. It is not production-deployed.

## Implemented

- Quarter/half/whole FT total settlement; fair odds and EV from a supplied PMF.
- Matched two-sided proportional no-vig only for .5 binary contracts.
- Strict separation of FT total and additional-goal target; current goals once.
- Exact source/revision deduplication, stale expiration, same-revision conflict
  rejection, bounded journal, checkpoint export/restore, scoped session storage.
- Graphs with a fixed 0–100% axis, gaps on missing observations or changed line,
  source or rules; remaining-goal bars and prices from actual supplied values.
- No new provider requests, background polling, D1 writes, legacy state setters
  or Push from the addon. Three-second timer only reads local detached state.
- Existing legacy score remains explicitly market-influenced, not an independent
  probability. Missing independent model is shown as MODEL WAIT.
- Transparent historical experimental baseline, up to eight unique FT fixtures
  before kickoff; no current match/future data, no missing goals treated as zero.

## Important incomplete production work

The recent-rate Poisson/time-only baseline is RESEARCH, not calibrated. It does
not model opponent strength, live intensity, red-card effects or uncertainty.
No generic code converts old scores to a new calibrated distribution. The app
may have no independent model if the existing DEEP data has not been fetched.
It must then wait visibly. No invented probability or fake curve is substituted.

TOP is currently stable *attention order by usable data completeness*, not a
validated opportunity competition. No arbitrary weights or EV threshold pretend
to be a tested investment ranking. RESEARCH/DEMO cannot issue a live recommendation.
Final adjudication of market/data hypotheses is transparent text based on observed
delta only; it does not claim to know bookmaker intent. An actual calibrated LIVE
model, settlement-aware market inversion for quarter lines, confidence intervals,
ranking validation, outcome-ledger integration and combined Push remain to be built
and accepted before production. Existing upstream statistics failure is unchanged.

The isolated published preview serves DEMO, layout and sanitized stored replay assets, has zero bindings and a
`connect-src 'none'` CSP. It cannot contact backend/provider or alter production.

No claim of production release, restored statistics or proven betting performance.

## Real stored-input audit

`capture-stored.mjs` first performs a bounded SELECT of at most 50 published production
`fe_notify_live_state` rows through the authenticated D1 query API. It requires
`meta.rows_written === 0`, checks all original deployment versions before/after,
and never calls a DO/scanner/provider or changes production configuration.
If no published UI snapshot exists, it reads up to 50 saved SOURCE_DETAIL rows
and uses unchanged backend normalization functions, without evaluating old engines.
These normalized historical sources remain explicitly identified as such.
`stored-replay.mjs` explicitly whitelists football fields; stored tokens, devices,
subscriptions and preferences are never written into the report or preview.

The replay at `/replay.html` displays original source times with actual current
freshness. STALE records remain STALE; the clock is not rewound to make TOP fill.
It has an explicit archive label and a selector for inspecting all retained
fixtures even if none can enter current TOP. It does not share session storage
with the live-input candidate. The independent model is absent unless a separate
valid source supplies one; old scores never become invented probabilities.

The workflow report distinguishes technical read/replay PASS from unproven live
model/recommendation acceptance. A successful capture is not a successful LIVE
scan, a restored upstream endpoint, or evidence of forecasting profitability.

## Input compatibility hardening

- The additive input bridge retains up to 50 detached DEEP bundles by fixture;
  selecting another match does not discard the previous match's context.
- Reads never change source observation times. A newly fetched context may enrich
  the model of the same football observation without replacing score, stats or
  price; stale and conflicting contexts are rejected.
- A separate detached controls read carries original cooldown/reset flags. It
  can block ranking and price use without rewriting stored observations.
- Provider market update timestamps are honored when supplied. Future/invalid
  updates are rejected, stale updates remain stale, paired main lines preferred.
- A generic engine hard veto is not treated as proof of a statistics-provider
  error. Existing `dataIncomplete`/NO_STATS indicators remain blocking.
- TOP buttons identify the fixture, remain unique, and preserve focus; nested
  expanded details survive refresh. Blocked cards show an explicit wait heading.

These changes complete input compatibility for the covered replay cases, not a
calibrated model, validated investment ranking or production LIVE/PUSH acceptance.

## Native layout integration (follow-up)

The new section is a native styled collapsible card immediately before H1/FT/HC.
It starts folded, preserves the existing navigation and shows the Overview charts
only when opened. Its CSS is scoped to its own card; no global legacy styles change.
The separate preview `/app/#ftOverviewCard` displays the exact pinned original
Mobile layout with this addition. This *layout-only* route blocks API, Push and
Worker connections by CSP and never contains demo fixtures. The standalone `/`
route remains explicitly fictional DEMO. Production integration is not deployed.

## FT V2 experimental decision-review overlay (24 Oct 2026)
The new pure function `ft-overview/experimental-decision.mjs` reviews existing FT Overview `assess` outputs and renders a distinct evidence, decision and sensitivity panel on the existing trial card. It does NOT change forecasting PMF, live-rate calibration, provider, D1, Push, default OFF pilot or legacy recommendation logic. The ±5pp probability sensitivity is a stress assumption, **not a statistical confidence interval**. It reports why a positive EV is fragile and why the same @2.10 quote can lead to trial over, wait price, model wait or contract mismatch based on state. No live calibrated model is claimed. Run `node ft-overview/test-experimental-decision.mjs`.
