# FT AI V2 — transparent valuation and five-minute recommendation window

Source base: 8c658ce445da1238d1da9335f0fa079d8bb26ff8. Mobile before: cafcdacf-9547-49f0-88be-c301180d076e.

Changes: explicit match outlook vs price decision; selected FT line and current decimal odds; fair odds, strict EV-positive price condition, model/market bars only for binary half lines; settlement distribution for all supported lines; experimental model provenance. Fair odds can be computed from an available independent PMF even when the current quote is missing, but never licenses an entry without fresh matching odds.

Five-minute sessions are per fixture, browser-memory only, retained across tab navigation in the current page. Original line/price/fair/EV/start/deadline remain immutable. Current price/data guards can pause entry. Goals, period or contract changes invalidate the session; a newer valid observation is needed before another session. Expired sessions cannot restart on repeated UI refresh of the same observation. Reloading the page clears these reference sessions; no durable audit capture is claimed.

Integer/quarter contracts do not display binary 1/odds breakeven or binary +/-5-point EV stress estimates. Exact existing priceOver settlement remains authoritative. No odds-dependent probability adjustment; no invented LIVE weights. LIVE evidence remains descriptive; model is historical constant-rate Poisson, explicitly uncalibrated. A missing new quality signal is not a claim that Under is likely.

Scope: four assets only: FT experimental-decision, integrated, view and shared CSS (new selectors scoped to FT root). Preserve the other 32 assets byte-for-byte, including all HT pricing and six-tab navigation. Preserve backend, Desktop, scanner, D1, provider request count, thresholds and Push behavior. No additional requests, no backend writes, no independent polling or scanner schedule.

Release workflow restores prior Mobile on post-deploy acceptance failure. Candidate and published browser QA use synthetic read-only bridge fixtures at 320/375/390/1280px; tests include original HT quote/session/goal chart, all six tabs, stable V2 root, FT pause/resume and goal invalidation. These tests do not certify real provider odds, forecasting performance, profitability or physical Push receipt. Deployment and public asset/version proof are emitted in the workflow artifact; this document alone does not certify deployment.

Remaining work: independently evaluate calibrated LIVE-conditioned probabilities with as-of forecasts and outcomes; connect V2-specific durable decision/outcome capture under a separately reviewed backend quota budget. Do not relabel historical-only probabilities as LIVE-adjusted.
