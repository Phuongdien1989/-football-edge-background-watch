# Football Edge FT AI V2 — 23/10/2026, Step 3M: Connect light preview to EXISTING FT Watch (READ-ONLY)

## State
- Draft [PR #16](https://github.com/Phuongdien1989/-football-edge-background-watch/pull/16) on `fix/ft-foundation-20261021`. **NO MERGE, NO production app deployment, NO scanner start, NO D1 / API-Football writes or calls** from this work.
- Source reference: current `worker_notify_v130.js` writes `item.ui.fixture`, `item.ui.snapshot`, `item.ui.engines.FT` and `item.history`. Existing Mobile `FEUIReadBridge.read()` exposes `watchState.items`. This carries already-observed score/league/team/minute/FT engine metric and stats. Existing Mobile does **not** preserve the independently comparable *original raw live bookmaker* feed required for FT pricing 3K. It must not be called an authenticated full FT odds observation/decision pair.
- The prior `mapFTLiveRows` read-only function still accepts hash-oriented staged Observation/Decision objects for the FT replay work; it remains independent.

## Implemented
- NEW `ft-v2-mobile/legacy-bridge.mjs`: pure `readExistingFTWatch(bridge,now)`; invokes `bridge.read()` once and selects FT `watchState.items` ONLY (not HT or HC). Reads verified fixture identity from stored `item.ui.fixture` and `item.ui.snapshot` (fallback `item.latest`), 2H 46–90 min, actual score, stamped capture time and FT Goal Radar score. Histories only use pre-snapshot statistics with SOT presence; labels as observed SOT, not scoring probability. One latest valid match per fixture; current vs stale marker; rejects unknown/future/ended/mismatched/too-old/malformed input. NEVER reads normalized-only bookmaker prices as verified FT quotes. Null actual fair odds, EV, recommendation and TOP.
- UPDATED `ft-v2-mobile/ui.mjs`: real observed SOT timeline separate from synthetic Goal Radar trend, latest FT score labeled *signal, not Over/Under probability*, explicit stale marker, complete empty states. Pure view, names escaped, CSS still scoped.
- UPDATED `ft-v2-mobile/preview.mjs`: standalone `?mode=live` reads existing `window.FEUIReadBridge` **if exposed on the preview page**; missing bridge yields an honest empty state. `FT_V2_PREVIEW_READ_ONLY.refresh()` re-reads existing state on deliberate invocation, without scanner, API, storage or push.
- NEW `ft-v2-mobile/test-legacy-bridge.mjs`: 22 offline regressions including exact fixture ID, SOT history and nulls, future source exclusion, dedupe most recent, stale marker, live status filtering, non-mutation of mock HT/HC histories/alerts, one read() call, and verified absence of synthetic quote/EV.
- UPDATED Chrome localhost smoke `ft-v2-mobile/test-browser.cjs`: injects **synthetic sample of EXISTING read-bridge shape only inside local browser QA**. Tests list, detail, actual SOT chart, no fake Poisson PMF/market pricing, all tabs and no external network requests. Captures 4 additional screenshots. Total **21 screenshots**.
- Existing FT total-goals Poisson experiment, 3K market evidence bridge and old Mobile 28-assets/10-HT protection are unchanged.
- Workflows `.github/workflows/ft-audit-foundation.yml` and `.github/workflows/ft-v2-light-preview.yml` include bridge regression.

## Verified independent CI
- [FT full candidate 39910067753](https://github.com/Phuongdien1989/-football-edge-background-watch/actions/runs/39910067753): **SUCCESS**.
- [FT local Chrome UI 39910079193](https://github.com/Phuongdien1989/-football-edge-background-watch/actions/runs/39910079193): **SUCCESS**.
- `FE_FT_V2_LIGHT_UI_PASS`: 23 checks, DEMO 5 fixtures, no LIVE EV.
- `FE_FT_V2_EXISTING_BRIDGE_PASS`: 22 tests, no API calls/writes, HT/HC unchanged in mocked source.
- `FE_FT_V2_BROWSER_PREVIEW_PASS`: 21 screenshots, widths 320/375/390/1280, missing bridge empty state and existing FT input shape, no external requests.
- [Download screenshot and HTML artifact via GitHub](https://github.com/Phuongdien1989/-football-edge-background-watch/actions/runs/39910079193/artifacts/12482412856).
- Build/CI success does NOT prove production has LIVE FT data flowing at this instant, HT/HC performance is unaffected under production load, or FT V2 calibrated probabilities.

## Remaining gates / next useful work
1. Preserve all 28 current Mobile assets and 10 HT valuation files; no shared UI mutations without explicit approval and baseline SHA comparisons.
2. FT source schema still lacks genuinely recorded hashed PAIR+OUTCOME tables on production; verified read-only Oct23 source audit reported tables absent. Future real calibration requires independent source-complete snapshots and actual regulation outcomes. No PMF and no real valuation/EV must be shown until tested.
3. To show independently verifiable bookmaker prices in V2, use paired *raw* live bookmaker observations from the FT recorder and normalized market rows, with correct book/period/settlement, receipt clocks and source parity. Existing FEUIReadBridge FT watch rows alone aren't enough.
4. Future in-app smoke, Mobile release and manual trial require explicit approval, D1 Free budget, HT/HC/TOP/Push nonregression and rollback verification. Scanner remains OFF as last independently verified; this offline run did not re-query Cloudflare production status.
5. Keep fixture intelligence and model updates separate from HT/HC.

**Conclusion:** UI is now source-adaptable and regression-tested with the existing FT watch structure, **not** installed on production or scored on real FT replay cases. Release readiness for V2 real pricing remains BLOCKED by actual provenance/calibration.
