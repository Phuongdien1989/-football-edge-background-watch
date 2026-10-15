# FOOTBALL EDGE — DESKTOP B2 ISOLATED PROTOTYPE CHECKPOINT

Date: 2026-10-15. **No production deployment.** This branch holds the independent read-only verification workflow **and the four B2 source assets** under `desktop-b2-preview/source/`. The complete original frontend HTML, synthesized prototype and visual-test bundle are delivered in `FOOTBALL_EDGE_DESKTOP_B2_OFFLINE_PREVIEW_20261015.zip` as conversation artifacts. Do **not** treat this branch as production-ready.

## Production frontend baseline independently confirmed
- Cloudflare script `shiny-silence-d892`
- ACTIVE version `03c1d55d-358a-448b-96f3-f356704831df` at 100%.
- Public HTTP 200, original HTML: 1,335,426 bytes.
- SHA-256 of both actual public HTML and archived frontend snapshot: `aa4f0f6318cd52c14ff62b195c5ea04c5267107455924da44c9aa78169fe7f28`.
- [Read-only GitHub Actions evidence](https://github.com/Phuongdien1989/-football-edge-background-watch/actions/runs/38689229767).
- Previous frontend rollback version `a3ffd320-54ec-4c5b-b7fd-eb6f95edb608`.

## B2 prototype design (OFFLINE, review-only)
- Uses the **exact archived frontend** as the base. No original inline JS, engine, D1 backend, API, TOP/EDGE selection, service worker or mobile style is edited.
- Adds 4 static preview assets: `desktop.css`, `desktop.js`, `demo-data.js`, `preview-guard.js`.
- Desktop >=1200px: collapsible sidebar, horizontal header and KPI, TOP1 region, search/filters, native-fixture DOM-derived match table, right drawer, history/validation/settings sections using original DOM nodes. No cloned IDs.
- 375/390/430px: original mobile shown. 768px uses original responsive layout.
- DEMO rows are explicitly synthetic and separated from engine data, all backend network and push registration disabled in this prototype; scan, deep and copy unavailable in isolated preview rather than faking results.
- B2 JS **never calls** `renderMasterOpportunityBoard()`, adds no polling, and performs no independent API/D1 writes.

## Browser regression results (Playwright set_content / Chromium)
Desktop: 1280, 1440, 1920 px UI and no horizontal overflow PASS.
Mobile: 375, 390, 430 px original display and no overflow PASS.
Search, LIVE/PRE filtering, drawer close/keyboard, sidebar, native history/validation/settings element reuse PASS.
Real LIVE fixture click owner, DEEP, scanner ON/OFF, real network requests and storage integration NOT VERIFIED due intentional offline barrier.
About:blank test harness may produce a `sessionStorage access denied` original-app error; interactive preview should be opened on localhost via provided Windows .bat script.

## Isolation of unrelated projects
PR6 remains `79cd4ddfa4191fa5a6e620683947d77e6ecbf31c`; PR7 remains `d73d4b19a069b0b2aed7e2687f27f1820f50e3d1`.
Backend production version at checkpoint `02d56762-ba08-4a8d-8654-bc9d522fc29a`; no changes to backend, frontend production, scanner, D1 or Cloudflare plan.

## Next
Review the delivered B2 ZIP on desktop. The four B2 source files are version-controlled in this branch; the exact production HTML baseline is preserved with SHA-256 and shipped in the ZIP. Do not merge or deploy without explicit approval and real-data regression.
