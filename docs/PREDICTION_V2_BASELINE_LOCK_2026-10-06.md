# FOOTBALL EDGE — PREDICTION V2 BASELINE LOCK

- Freeze date: 2026-10-06
- Status: FROZEN / ROLLBACK SOURCE
- Production service: `shiny-silence-d892`
- Exact P2.0.5.2 frontend SHA256: `a82bf87e1db875fb975b94ac9b6df9e785818de37b7bb55fec6f290efca9c844`
- Pre-hotfix baseline SHA256: `f2d5c471c247ed77b07e3cb9096e5c04ae9c69b4d8af1b25a4fbe7ca955bfb5c`
- Actual deployed commit: `58705584cf777766f28e50ac937d2972000e302f`
- Immutable rollback branch: `freeze/frontend-p2052-production-before-prediction-v2-20261006`
- Development/audit branch: `work/prediction-v2-audit-20261006`

Production is not modified by this lock.

Important: the historical V137 worker freeze contains 50K quota lineage. The current API plan is 75,000/day; do not carry the old 50K value into Prediction V2 without explicit quota migration/audit.
