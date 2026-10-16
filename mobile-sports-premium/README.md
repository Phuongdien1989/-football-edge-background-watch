# Football Edge — Mobile Sports Premium Preview (2026-10-16)

Status: **PREVIEW ONLY. NOT a Mobile production deployment.** The original HTML production SHA-256 is `aa4f0f6318cd52c14ff62b195c5ea04c5267107455924da44c9aa78169fe7f28`, corresponding to frontend version `03c1d55d-358a-448b-96f3-f356704831df` at the last independently verified checkpoint. Before publishing preview, GitHub Actions re-downloads and validates the exact actual live production bytes.

## Scope

- New `source/premium.css`: bounded to `body.fe-sp-enabled` and `max-width: 767px`; other viewport sizes retain native UI; no saved theme rewritten.
- New `source/premium.js`: one display-only UI shell, read-only native `FEUIReadBridge.read` and `FEAddonBridge.masterRows`; native `#matches .match[data-i]` click for fixture select; `#prepareBtn` for explicit DEEP, and native `#feScanControlBtn` after confirm for shared ON/OFF; routes via original bottom nav. It does not itself call any remote API, render master engine, write Outbox or start new polling. One bounded MutationObserver, rAF updates.
- `build.py`: pins actual baseline SHA; only isolated preview removal of automatic SW registration and Push SW setup, inserts inline CSS/JS. Does **not** include experimental Mobile Outbox fixes.
- `worker.mjs` with `[assets]`: static frontend only, no D1, no backend binding, no proxy. In default `?mode=demo`, HTTP CSP `connect-src 'none'; worker-src 'none'` prevents accidental remote API and Push use. `?mode=connected` only after explicit user selection; separate origin needs separate API/Worker credentials and may encounter backend CORS. No backend changes authorized for preview.
- Real engine DQ/EDGE/score: missing shows `—`; no percentage assumed for EDGE; TOP 1 only `__rank.top===1`, no text parse and no new ranking.

## Preview controls

By default DEMO banner and fictional fixtures appear — cannot execute real scan/DEEP/Push. Tap **THỬ KẾT NỐI** to switch to connected mode, configure source under native Settings and voluntarily run native scans. The preview ON/OFF affects shared backend when configured; confirm is mandatory. Do not use preview for Push subscription: disabled by design.

## QA/limitations

Chromium localhost 375/390/430/844/1440, horizontal overflow, console errors, native bridge, tab filtering, DEMO guard, browser network counts, connected no DEMO leak. iPhone 13/8 Safari, real backend CORS, actual DEEP/Copy and ongoing Push delivery **NOT VERIFIED** until user acceptance. If CORS blocks, never widen backend permissions without approval.

## Rollback

Mobile production remains unchanged: `03c1d55d-358a-448b-96f3-f356704831df`. Removing/disabling only Worker `football-edge-mobile-sports-premium-preview` restores previous setup; do **not** point the Mobile production route to the preview. If prototype behavior fails, close preview and use original production iPhone bookmark/PWA. Desktop B2 Worker remains `a332ee39-abb2-422d-a021-db78ef19cc10` at last checkpoint.
