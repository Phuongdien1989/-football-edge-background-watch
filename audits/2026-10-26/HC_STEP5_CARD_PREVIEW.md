# HC step 5 — isolated research card preview (2026-10-26)

Continues PR #25 from 07c315490c25fc71cd96ac5d861b6f5cb2401acd.
No production entrypoint, bundle, backend, HT/FT, ranking, Push or scanner changes.

## Display contract

- Compact white/navy/emerald card; league, team names, fixture ID, score, phase, minute and observation age.
- Data view: FT home/draw/away outcome probabilities from the independent research model; explicitly not AH cover probabilities. Sample sizes and limitations included.
- Legacy view: original HC GAP, explicitly an advantage score rather than calibrated probability. Existing HC order retained; duplicate fixture IDs removed; maximum five distinct fixtures, no new ranking.
- Market view: each exact source/line pair separately. Both sides' decimal market odds, fair model odds, EV and expandable five-state settlement distribution.
- Unknown source settlement rule: RULE_WAIT. Full-match and remaining-match valuations shown only inside an initially collapsed, explicitly hypothetical section. No chosen side, entry button, recommendation or Push.
- Verified rule: research pricing only, with full-match/remaining-match label. Model is still uncalibrated; a positive EV does not authorize entry.
- Old observations (>60 seconds), missing/future timestamp: hide any old prices and show DATA_WAIT. Displayed old model outcome probabilities are labeled stale. No price refreshed merely by a clock tick.
- External team/league/source/reason strings HTML-escaped. No links from untrusted source text.

## Files and verification

`view.mjs` is pure HTML rendering plus an explicitly invoked mount with cleanup. No global auto-mount, polling, network, persistence or production bridge registration. Caller must rerender on an observation/clock event to enforce age transitions; it has no autonomous timer. This is an isolated preview, not yet a production integration.

`preview.html` / `preview.mjs` / `preview.css` use clearly labeled synthetic data, no production endpoints. Serve the hc-model folder with a local static server; do not open as file:// because ES modules require HTTP.

`test-view.mjs`: unknown/verified rules, all settlement states, stale valuation, HTML escaping, dedup/order/limit, missing data and no I/O.
`test-browser.cjs`: Chrome 320/375/390/1280px, collapsed and expanded contracts, settlement details, no horizontal overflow, JS errors or nonlocal/non-GET requests. Screenshots in workflow artifacts. All examples synthetic; no forecast-performance or physical Push certification.

## Remaining before release

Review the preview appearance. Then integrate read-only with existing bridge observations, including lifecycle/age rerender, preserving HT/FT assets and original HC tool. Five-minute original-vs-current recommendation/session behavior is not introduced by this preview; it must be specified and tested before actionable HC recommendations. Source-specific settlement rules, LIVE calibration and forward performance remain unverified. Production stays on its existing release; no Cloudflare credentials used here.
