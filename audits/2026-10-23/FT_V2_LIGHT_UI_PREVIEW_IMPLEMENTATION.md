# Football Edge — FT AI V2 Light Mobile UI Preview Implementation

Date: 2026-10-23 (ICT). Status: **OFFLINE/UI PREVIEW IMPLEMENTED AND VERIFIED**, draft PR #16 only. No production deployment, no merge, no scan activation, no D1 writes, no API Football calls.

## Design fidelity to the user's current Mobile
CSS extracted from existing `ui-tabs-preview/style.css` and `ui-tabs-preview/integrated.css` (reference only):
- Background `#eff6fc`, white cards `#fff`, blue `#147cf5`, green `#08a978`, navy text `#17345c`, light border `#e2ecf5`.
- No stadium background, neon/dark theme or global CSS overrides. All styling scoped under `.ftv2-app`.
- Dense compact cards consistent with current HT/HC UI and iPhone widths.

## Files implemented (new isolated directory)
- `ft-v2-mobile/read-model.mjs`: read-only adapter from existing frozen FT Observation+Decision and `extractFTPricingEvidence`. Requires real fixture/odds chronology and raw prices. No `goal_ft` or FT score converted into total-goals PMF. LIVE output deliberately `WAIT_MODEL`, null fair odds, null EV, null TOP; any caller-injected prices/recommendations are stripped by `normalizeFTPreviewPacket`.
- `ft-v2-mobile/demo-data.mjs`: **separate synthetic/fictional** five-distinct-fixture demo. Asian totals EV and fair odds are computed consistently by existing `reviewFTTotalPrice` math but are NEVER release-eligible; clearly watermarked DEMO and never imported by live adapter.
- `ft-v2-mobile/ui.mjs`: independent list view, filters, match detail with 4 local tabs (Summary/Charts/Pricing/History), fulltime distribution bars and binary FT signal trend explicitly differentiated, 2.0–3.5 pricing table, price receipt time, market completeness, clear wait states. Sensitive names HTML-escaped. No effect on existing shared tabs or DOM outside supplied isolated root.
- `ft-v2-mobile/style.css`: scoped, exact light Mobile styling and responsive compact layout.
- `ft-v2-mobile/preview.html` + `preview.mjs`: standalone *local* interactive preview with explicit DEMO banner. `?mode=live` shows the empty read-only state, no synthetic prices or matches.
- `ft-v2-mobile/test.mjs`: **23/23 PASS** software/integrity guards and demo isolation.
- `ft-v2-mobile/test-browser.cjs`: localhost-only Playwright Chrome tests, exact computed light background, filters, list/details, probability charts and pricing table; **17 screenshots** across **320, 375, 390, 1280 px** plus empty LIVE state; no external browser requests.

## Automated proof
- [FT full candidate suite](https://github.com/Phuongdien1989/-football-edge-background-watch/actions/runs/39908418238): PASS including legacy HT/HC isolation and FT math tests.
- [FT UI Chrome visual preview](https://github.com/Phuongdien1989/-football-edge-background-watch/actions/runs/39908482607): PASS. `FE_FT_V2_LIGHT_UI_PASS` 23/23, `FE_FT_MOBILE_HT_ISOLATION_PASS` 20/20, `FE_FT_V2_BROWSER_PREVIEW_PASS` 17 screenshot captures. No external traffic.
- [Preview artifact ZIP](https://github.com/Phuongdien1989/-football-edge-background-watch/actions/runs/39908482607/artifacts/12481637981): `ft-v2-light-mobile-preview-only`. This is an offline preview package, **NOT the app**.
- Initial UI test failed because shared test references modified raw and normalized odds together. Test fixture isolation corrected, no guard relaxed. Second UI test exposed that empty-trend presentation did not explicitly say Goal Radar score is not probability; text was hardened. Final CI PASS.

## Strict preservation
- The existing Mobile production release has 28 total files, including 10 HT valuation assets restored October 23. `ft-audit-fix/mobile-asset-isolation.mjs` and `test-mobile-asset-isolation.mjs` retain 20/20 PASS.
- No edits to HT/HC algorithm, threshold, TOP, Push, service worker, shared tab modules, scanner or Cloudflare D1.
- This preview is NOT yet wired into the user-facing production Mobile; it must not replace the present app until separately approved and fully validated.

## Next useful work (keep focus FT)
1. Integrate UI adapter **read-only** with genuinely available FT V2 snapshots (not demo) in a scoped preview without changing source ranking; collect label/quality and signal history.
2. Continue separate real training cohort issue: Oct23 production read-only schema inspection reported FT pair/outcome replay tables absent. Deploying the model without provenance-clean real pairs is prohibited; avoid quota-exhausting D1 writes.
3. Finish and calibrate FT total-goals PMF on real chronologically independent matches before enabling fair odds, EV and real TOP. Do not show imaginary EV because an experimental Poisson PMF can be generated.
4. Future production approval requires complete current 28+ assets parity, browser/iPhone regression, HT/HC/TOP/Push comparison with FT flag ON/OFF, D1/API measured budget and both rollback versions. No autorun scanner.

**Checkpoint result: UI/UX preview complete for review, real FT AI model and production FT recommendations still not complete.**
