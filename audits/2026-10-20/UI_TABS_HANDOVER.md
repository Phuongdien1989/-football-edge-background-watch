# FOOTBALL EDGE — UI TABS HANDOVER — 2026-10-20
Owner authorized gradual implementation with checkpoints, separate preview, no production UI change until acceptance.
## Baseline
Repository Phuongdien1989/-football-edge-background-watch.
Feature branch feature/ft-overview-shadow-20261019; starting head 73afa06f830259013dc3b78a57e47332a07a3fc6.
Last release tested source 9629821089991e603a90ae9bd04f4ebf262ebf0d.
Expected Mobile b73642ec-1d4c-41ae-bc28-68c785b6fd79; backend 04cc044d-412f-4844-9b83-c7c786eedd13; Desktop a332ee39-abb2-422d-a021-db78ef19cc10.
Mobile current HTML expected SHA256 9c557b2b20744aaad5b14ddd367517bd4afb00a7af182ead93e346f857f9947e.
Immediate preceding Mobile rollback ac8c0da2-551c-4561-a554-efd4c09339ad; do not mistake it for the current baseline. Verify both exist, do not exercise rollback while freezing.
## Sequence
1. Read-only production verification and freeze static Mobile package. Never export secret values, user data, D1 records, credentials or subscriptions. This is a frontend backup, NOT a database backup or full Cloudflare account export.
2. Dependency and navigation design.
3. Isolated tab mockup without network or Push.
4. Read-only data integration preserving original ranking.
5. Browser acceptance and request/timer/state regression checks.
6. Production frontend release only after owner accepts preview; preserve current baseline rollback.
## Design
Five tabs: Overview / HT Goals / FT Goals / Handicap / FT Overview. Sticky 2-row tabs on narrow screens.
Overview preserves existing Master TOP 1–5 (unique fixtures), adds per-engine badges and four leaders. FT Overview retains separate experimental EV ranking. Do not invent a combined score. Any future common ranking is a separate change.
Tap row -> fixture detail -> return preserving position. Retain full legacy analysis behind collapsible detail.
Settings/Push/DB diagnostics and history remain accessible separately.
## Dependency findings
Original HTML contains Matches route, Analysis route, P1 accordion, master-card links and several polling/render timers.
FEUIReadBridge supplies detached HT/FT/HC data. FEAddonBridge.masterRows supplies ranked legacy Master rows.
FEAddonBridge also exposes mutating/network methods: new display adapter MUST NOT call request/toggleManual/refreshEntryValidation automatically.
FTOverviewPreview.read supplies browser-local overview store; selection uses select(id).
Hide/show existing nodes; do not clone ID-bearing forms or remount engines.
One navigation owner must coordinate legacy route classes, accordion visibility and deep links; preserve event targets.
Master ranking feeds Smart Follow: UI-only aggregate must NOT replace source TOP, registry selection, thresholds or engine timers.
Tab switch: zero network, zero D1 writes, zero scan toggles, zero extra timers, no timestamp refresh.
## Acceptance
Screens 375/390/414 and Desktop compatibility; Safari/PWA manual acceptance still required.
Empty/missing/stale/error/zero-valid inputs, live score change/cooldown/end state, long names, restart, browser back, Push deep-link target.
Repeated tab switches: scores/ranks/recommendations unchanged and request counts do not increase.
No claim of proven betting efficacy; FT Overview remains trial and no new Push channel exists.
## Status at this document
No tab implementation yet. Freeze workflow will publish evidence and ZIP; PASS must be checked from its actual result, not assumed.
Public root from local environment returned HTTP403; use authenticated Actions for production version verification.
Continue from this checkpoint; do not rerun unrelated passed model tests unless implementation affects them.
