# Football Edge — Mobile Sports Premium Preview (2026-10-16)

Status: **PREVIEW ONLY. NOT a Mobile production deployment.** The original HTML production SHA-256 is `aa4f0f6318cd52c14ff62b195c5ea04c5267107455924da44c9aa78169fe7f28`, corresponding to frontend version `03c1d55d-358a-448b-96f3-f356704831df` at the last independently verified checkpoint. Before publishing preview, GitHub Actions re-downloads and validates the exact actual live production bytes.

## Scope

- New `source/premium.css`: bounded to `body.fe-sp-enabled` and `max-width: 767px`; other viewport sizes retain native UI; no saved theme rewritten.
- New `source/premium.js`: one display-only UI shell, read-only native `FEUIReadBridge.read` and `FEAddonBridge.masterRows`; native `FE_SP_NATIVE.selectById(fixture_id)` bridge calling original `selectFixture(index)` for fixture selection; `#prepareBtn` for explicit DEEP, and native `#feScanControlBtn` after confirm for shared ON/OFF; routes via original bottom nav. It does not itself call any remote API, render master engine, write Outbox or start new polling. One bounded MutationObserver, rAF updates.
- `build.py`: pins actual baseline SHA; only isolated preview removal of automatic SW registration, Push registration, startup Background Watch sync, focus/visibility sync, and timed QSIG registration, inserts inline CSS/JS. Does **not** include experimental Mobile Outbox fixes.
- `worker.mjs` with `[assets]`: static frontend only, no D1, no backend binding, no proxy; `run_worker_first = true` enforces preview CSP on every HTML request. In default `?mode=demo`, HTTP CSP `connect-src 'none'; worker-src 'none'` prevents accidental remote API and Push use. `?mode=connected` only after explicit user selection; separate origin needs separate API/Worker credentials and may encounter backend CORS. No backend changes authorized for preview.
- Real engine DQ/EDGE/score: missing shows `—`; no percentage assumed for EDGE; TOP 1 only `__rank.top===1`, no text parse and no new ranking.

## Preview controls

By default DEMO banner and fictional fixtures appear — cannot execute real scan/DEEP/Push. Tap **THỬ KẾT NỐI** to switch to connected mode, configure source under native Settings and voluntarily run native scans. The preview ON/OFF affects shared backend when configured; confirm is mandatory. Do not use preview for Push subscription: disabled by design.

## QA/limitations

Chromium localhost 375/390/430/844/1440, horizontal overflow, console errors, native bridge, tab filtering, DEMO guard, browser network counts, connected no DEMO leak. iPhone 13/8 Safari, real backend CORS, actual DEEP/Copy and ongoing Push delivery **NOT VERIFIED** until user acceptance. If CORS blocks, never widen backend permissions without approval.

## Rollback

Mobile production remains unchanged: `03c1d55d-358a-448b-96f3-f356704831df`. Removing/disabling only Worker `football-edge-mobile-sports-premium-preview` restores previous setup; do **not** point the Mobile production route to the preview. If prototype behavior fails, close preview and use original production iPhone bookmark/PWA. Desktop B2 Worker remains `a332ee39-abb2-422d-a021-db78ef19cc10` at last checkpoint.

## Freshness, safe startup, and remaining acceptance gates

- REAL LIVE rows without an independently verified updated-at timestamp show `LIVE ?` using a muted badge; stale LIVE rows show `CŨ`. Demonstration rows are visibly labeled DEMO.
- The preview suppresses *passive* native startup/focus/visibility Background Watch syncing and timed QSIG auto-registration, including after preview-specific credentials are saved. Explicit native actions still use original handlers.
- Actual API success and TOP/EDGE/DEEP/Copy equivalence must be accepted on real iPhone/browser with separately configured preview origin. Mock/screenshot PASS is not a substitute; server CORS may limit this.
- The static preview Worker has no D1/DO/notification bindings; HTTPS CSP in default DEMO denies `connect-src` and all Service Workers.
