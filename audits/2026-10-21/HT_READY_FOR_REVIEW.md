# Football Edge HT — final review checkpoint, 21/10/2026

Code: a9e9cc68cc07af27bdca0305b6f227da12f64cb9

State: READY FOR REVIEW. Main app has NOT been changed.

## Delivered

Early HT collection → true HT team-history research model → exact first-half contract pricing → integrated HT card, with detailed old component scores preserved. The old score-derived percentage is hidden on the native HT card to avoid presenting two probability estimates. FT behavior, Master TOP and existing Push gates are preserved.

Real D1 inspection found 2 rows and no usable half-time history. This was not treated as a working model. The candidate now warms missing team history through the existing Mobile cache/backend quota wrapper, at most 2 extra team-history calls per scan cycle. Cache hits make no extra calls; no timer, API budget increase, paid upgrade or D1 history writes were added.

The predictor remains an uncalibrated Gamma–Poisson research baseline using actual HT scores, current goals and elapsed time. It does not adjust rate for shot intensity, opponent strength, red cards or added time. Sample size and assumptions remain visible. Synthetic tests prove mechanics, not football forecast accuracy.

## Evidence

- [Final code workflow PASS](https://github.com/Phuongdien1989/-football-edge-background-watch/actions/runs/39491133238): 81 tests, 4 Chromium/WebKit/390px/1280px browser cases, backend dry-run.
- Bundle: 562.33 KiB; gzip 124.63 KiB.
- [Read-only real history check](https://github.com/Phuongdien1989/-football-edge-background-watch/actions/runs/39489975309): 4 D1 rows read, zero writes/provider calls.
- [Candidate ZIP and evidence](https://github.com/Phuongdien1989/-football-edge-background-watch/actions/runs/39491133238/artifacts/12296196931).
- [Review demo](https://football-edge-ht-candidate.ngophuonghuy.workers.dev/): fictional data only, zero bindings and no API/D1/Push.
- Preview version: 011bbe49-aee7-4f28-be4d-1ed7b92123a9.

The archive includes pinned source/assets backup, not a database dump. Do not deploy a single generated scanner file.

## Production preservation

Preview publication verified exactly the same active versions before/after:

- Mobile: 3c0e47ed-275b-410c-b527-77f1ff65a28a
- Backend: 04cc044d-412f-4844-9b83-c7c786eedd13
- Desktop: a332ee39-abb2-422d-a021-db78ef19cc10

No scanner toggle, production release or rollback action was performed.

## Release boundary

Real iPhone/PWA review, authenticated staging warm-up/data synchronization, LIVE/PUSH and account quota must be accepted before the main-app release. The preview is a safe visual review, not a live pilot. Existing early research pricing does not silently enable early Push or replace the old Push score policy.
