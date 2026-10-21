# HT Match Intelligence — implementation boundaries, 21 October 2026

Forecast and market valuation remain separate. A higher offered OVER price must not lower the independent model probability. A large disagreement is evidence to investigate, not an automatic rejection or a guarantee of profit.

This batch fixes early HT market transport independent of activity, including market-only updates when stats reuse the same observation. It adds local five-minute recommendation records with immutable original contract/price, a fixed deadline, continuously reassessed current price/value, immediate invalidation on score/red/phase/reset changes, stale-data waiting, reload recovery and deduplicated local session events. Other lines cannot silently replace an ongoing contract. No bet placement, API polling timer or D1 session writes are added.

Quiet early fixtures can now cost one additional market request when the existing shared market cache expires. Cache hits make no such request. Existing API wrappers/caps/cadence are reused. Market errors never renew old quote timestamps.

Session state is per browser/device. It is not yet shared across phones or connected to server Push. Legacy Push/thresholds, FT/HC/Master, backend and database remain unchanged. Current Gamma–Poisson research probabilities still use true halftime history, elapsed time and observed goals; shot quality, opponent strength and red-card rate adjustment are NOT implemented in this batch. There is no claim of calibrated probabilities or profitability.

Next batch: collect real pre-match/live/market observations with provenance and outcome validation; develop and compare a live-updated independent forecast without arbitrary hand-tuned weights. Only then connect its reconciliation to ranking and server Push/session lifecycle.

Pre-session Mobile rollback: 0a87e8c1-c1fa-4a89-ac54-ddd47ab6b2ed. Backend remains fe5c9fb5-ae1d-4aa6-8850-8cbdeb2b8e73. Earlier pre-HT rollback remains 3c0e47ed-275b-410c-b527-77f1ff65a28a (Mobile) and 04cc044d-412f-4844-9b83-c7c786eedd13 (backend).
