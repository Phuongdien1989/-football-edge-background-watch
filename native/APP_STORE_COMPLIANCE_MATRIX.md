# Football Edge — App Store Compliance Matrix

Purpose: prepare an App Store edition without changing the production PWA or the scoring/analysis engines. This is an additive compliance layer, not a hidden-review switch.

## Core product position

Football Edge Store Edition is a sports analytics and live match intelligence app. It does not accept wagers, hold balances, accept deposits or withdrawals, execute bets, integrate with bookmakers, or provide affiliate links to betting operators.

## Compliance matrix

| Module / behavior | Store decision | Required action | Main reason |
|---|---|---|---|
| Match Center / live fixtures | KEEP | Present as live match discovery and analysis | Core sports utility |
| H1 Watch | KEEP | Rename public wording to live first-half signal / pressure signal where needed | Keep analytics, avoid betting-directed wording |
| Goal Radar FT | KEEP | Present as goal-likelihood / scoring-pressure signal | Analytics function can remain |
| LIVE GAP | KEEP | Present as live momentum / team-state gap | Sports intelligence function |
| TOP1 / TOP2-5 ranking | KEEP | Describe as analysis priority, not a bet recommendation | Relative prioritization is acceptable if clearly analytical |
| Data Quality / freshness / integrity | KEEP | Expose clearly | Supports transparency and reviewer understanding |
| Historical form / table / team strength | KEEP | Keep as context/prior | Standard sports data |
| Market odds / handicap / O-U data | MODIFY | Rename to Market Context / Market Movement; no bookmaker branding, no affiliate links, no bet execution | Reduces risk of being interpreted as wagering facilitation |
| Entry Policy / ENTRY SUITABLE | MODIFY | Replace public Store wording with Signal Strength / Confirmation State / Monitor / Insufficient Evidence | Avoid direct wagering action language |
| WAIT_PRICE | MODIFY | Replace with Wait for confirmation / Market confirmation pending | Avoid price-entry instruction semantics |
| "kèo", "đánh", "vào cửa", "stake", "bankroll" public wording | REMOVE FROM STORE UI | Use neutral sports-analysis wording | Avoid gambling-directed presentation |
| Bet Tracker | EXCLUDE FROM STORE BUILD | Do not ship monetary bet tracking in first App Store release | High review and legal risk; not required for core analytics |
| Monetary P&L / profit-loss | EXCLUDE / REFRAME | Use Prediction Journal / Signal Accuracy without stake or money | Avoid gambling-accounting behavior |
| Auto-bet / bookmaker handoff | PROHIBITED | Do not implement | Would materially change product category and legal/review obligations |
| Bookmaker links / affiliate tracking | PROHIBITED | Do not include | High gambling/commercial facilitation risk |
| Push notifications | KEEP | User opt-in; neutral wording such as "Live match signal detected"; easy disable | Useful native feature; must not be required to use app |
| Native deep link from push | KEEP | Open the relevant fixture/analysis screen | Native utility |
| Push token / native device ID | KEEP WITH PRIVACY CONTROLS | Document purpose/retention and provide Disconnect & Delete Notification Data | Privacy compliance |
| Shared Background Worker token in Settings | REPLACE FOR STORE | Move to app-safe device registration/session mechanism; do not expose a shared backend secret to users | Security/release readiness |
| D1 signal/validation history | KEEP WITH DISCLOSURE | Limit to necessary data; document retention and deletion path | Privacy/data minimization |
| Release Health / diagnostics | KEEP INTERNAL OR SUPPORT MODE | Avoid exposing raw provider/internal errors as primary UI | Better App Review completeness and UX |
| Provider/API outage state | MODIFY | Friendly degraded-state UI plus retry; do not show confusing raw errors | App completeness/reliability |
| Sample Analysis | ADD | Always-available clearly labeled demo/sample fixture | Gives reviewer usable functionality when no LIVE match exists or upstream data is unavailable |
| Native onboarding | ADD | Explain sports analytics purpose, push opt-in, and no wagering/transactions | Helps reviewer and user understand product scope |
| Native Settings | ADD | Notification controls, privacy, support, data deletion/disconnect | Native utility + compliance |
| Privacy Policy screen/link | ADD | Explain collected data, purpose, sharing, retention, deletion, contact | Required release readiness |
| Support page | ADD | Contact/support path accessible from app and App Store metadata | App Store metadata readiness |
| App Store screenshots/description | MODIFY | No betting claims, no "guaranteed win", no stake/profit imagery; show analytics, DQ, live state, alerts | Accurate metadata and lower review ambiguity |
| Age rating questionnaire | COMPLETE ACCURATELY | Answer based on actual Store build; do not understate gambling-related content if any remains | Vietnam region-specific rating is assigned from questionnaire responses |
| Team/league logos | REVIEW RIGHTS | Prefer neutral icons/text unless rights are confirmed | Third-party IP risk |

## Apple review gates

1. Store build contains no wagering, deposits, withdrawals, bookmaker integration, affiliate betting links, stake sizing, or auto-bet execution.
2. Store metadata matches the real feature set. No dormant/hidden gambling feature is enabled after review.
3. App has meaningful native utility beyond a simple web wrapper: native push, deep links, onboarding/settings, share/support/privacy, graceful offline/degraded handling.
4. Reviewer can test core functionality even when no live fixture is available through Sample Analysis.
5. Backend is reachable and failure states are user-safe and understandable.
6. Privacy Policy, Support URL, App Privacy answers, deletion/disconnect control, and age-rating questionnaire are ready before submission.

## Vietnam release gates

1. Product remains sports analytics, not an operator or facilitator of real-money betting.
2. No local wagering execution, deposits/withdrawals, bookmaker handoff, or affiliate betting flow.
3. Personal-data handling is documented and minimized; users can disconnect/delete notification-device data.
4. Vietnam age-rating questionnaire responses accurately describe the actual Store build.

## Non-regression rule

The production PWA remains unchanged while Store Edition work happens on a separate native/release branch. Engine scoring, thresholds, calibration, DQ logic and PRESENT-FIRST / ADAPTIVE LIVE STATE are not changed merely for compliance. Compliance changes apply to public wording, release-only modules, privacy/security controls, native UX and Store metadata unless a separate validated engine change is approved.

## Implementation order

1. Store-mode feature manifest (explicit include/exclude list at build time; not a remote review switch).
2. Public wording migration: Entry/price/bet language -> neutral sports intelligence terminology.
3. Exclude Bet Tracker and monetary P&L from Store build; add Prediction Journal / Signal Accuracy if needed.
4. Add Privacy, Support, Disconnect/Delete Device Data.
5. Replace shared Background Worker token flow for consumer Store build.
6. Add Sample Analysis and graceful degraded-state UI.
7. Add native onboarding/settings/share/support polish.
8. Prepare App Store metadata, screenshots, App Privacy and age rating.
9. After Apple Developer membership is active: signing, APNs production, TestFlight field test, then App Review.
