# FT V2 score/time-conditioned probability and moving valuation

Base development commit: 3c23b8978a4876568c884169dece49b1fc037b3f. Mobile before: d1bcbd0a-d4e3-4e4b-a84d-867ae6aa7d4c.

## Model
FT_GAMMA_POISSON_STATE_V1 is an opt-in FT V2-only research model. Default readLegacy and the legacy FT Overview retain RECENT_RATE_TIME_ONLY_V1. Take up to eight valid completed, pre-kickoff FT fixtures involving each team; deduplicate the combined pool, exclude conflicting duplicate records and future/current fixtures. For the pooled total-goal rate use Jeffreys alpha=0.5 plus historical goals, beta=unique historical matches. At the observed nominal regulation minute t with current total goals g, posterior alpha=prior_alpha+g and beta=prior_beta+t/90. Predict remaining goals with the Gamma-Poisson posterior predictive at exposure=(90-t)/90. Add observed goals exactly once during line settlement. Market odds do not enter the model.

The distribution updates only on accepted source observations. First-half stoppage consumes no second-half regulation minutes. FT stoppage at/after 90 is MODEL_WAIT rather than pretending no time remains. No arbitrary xG/shot/red-card coefficients, guessed added time or confidence claims. Model remains uncalibrated: constant-rate assumption, no opponent-strength or live-pressure adjustment. Observed goals update the latent rate, not prove an increase in pressure. Broader LIVE pressure calibration still needs independently captured as-of forecast/outcome data.

## UI/session
Current fair odds, win probability, EV and remaining goals are shown beside immutable original values from the five-minute session. Goal/phase/contract/red-card changes invalidate the reference (red only when source exposes that field). No comparison delta is claimed across invalidated states. Current quote/data guards remain active. Browser-memory sessions survive tab navigation, not page reload. One-second timer updates the countdown DOM only; model refresh uses existing event hooks and 15-second bridge reads, with no additional network requests. Disclosure open/closed state survives valuation updates.

## Scope/release
Six FT V2 assets change: adapter, live-probability, experimental-decision, integrated, view and CSS. Other 30 static assets, including root HTML, all HT modules, navigation and legacy Overview assets, must match the preceding deployment hashes. No backend, Desktop, D1, scanner scheduling, thresholds, Push or schema changes. Production version guard and complete 36-file backup precede deployment; post-deploy test failure restores the previous Mobile version.

Tests cover posterior recurrence/mean, no-goal time, changed score, odds independence, historical duplicate/conflict/future filters, phase and stoppage clocks, legacy adapter isolation, actual adapter/store/review/session updates, prior valuation/session regression, four-width candidate and published browser QA, HT preservation and all six tabs. Synthetic QA does not certify forecasting performance, real provider data or physical Push delivery. Workflow artifact contains deployment versions, public hashes, reports and screenshots; this document does not itself certify deployment.
