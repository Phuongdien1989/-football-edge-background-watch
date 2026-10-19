# FT OVERVIEW — isolated research candidate

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

The isolated published preview serves only DEMO assets, has zero bindings and a
`connect-src 'none'` CSP. It cannot contact backend/provider or alter production.

No claim of production release, restored statistics or proven betting performance.

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
