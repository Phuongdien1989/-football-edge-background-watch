# Mechanism-specific notifications

## Source and deployment boundaries

Continue integration `0df5d8f365d900ec9b785cc49f1f19e95998dabc`.
Backend source is the **actual deployed package**, not the older root Worker files:
artifact `scan-status-recovery-evidence`, run `39567549512`, version
`e7d2090c-d0e1-4f58-9f5a-4360acd2ced3`, deploy commit
`3cd210d2d74aff547de4587ab4a3c96b982a728c`.
Mobile source is all 54 verified assets from run `41014881913`, version
`c9b86303-7031-4068-a4fe-808de4a0093a`.
Both exact versions remain rollback targets. Desktop is unchanged.

## Delivery policies

| Mechanism | Notification policy |
| --- | --- |
| HT | Exact existing `assessHTItem`, `TRIAL_OVER`, valid current source and HT quote, model EV > 0. No legacy H1 score gate. |
| FT Overview | Existing independent time-only baseline and `assess`, `TRIAL_OVER`, correct current contract. |
| FT AI V2 | Existing score/time-conditioned model and `reviewFTDecision`, `TRIAL_OVER`. |
| Goal FT | Existing per-device probability crossing, explicitly labelled a signal, not a priced entry. |
| HC GAP | Existing per-device GAP crossing, explicitly labelled a signal, not a handicap entry. |
| HC research | NO ENTRY PUSH: existing research policy has no chosen side/tradeReady; source settlement rules remain unverified. |
| Overview | No extra signal. Group by device and fixture; deliver mechanism labels in one notification. |

No new probability/EV cutoffs, ranking rules, scanner cadence or model adjustments.
HT, FT Overview and FT V2 share exact pricing functions with Mobile. Published
snapshots carry the actual bounded historical context used by background pricing.
Mobile reuses it only for the same fixture and source observation. A newer local
observation keeps its own context; no server context is borrowed across times.
The existing HT collector/history warm-up remains. FT reads existing D1 history
using indexed queries cached for 30 minutes (240 cached team/fixture keys maximum),
without adding provider requests or backfilling invented history.

## Delivery and reference state

One durable DO reservation per device/fixture before sending, then one accepted/
unconfirmed result write. Repeated idle observations make no ledger writes.
Current recommendation reference is immutable for five minutes; a five-minute
reference never overrides data, event, phase, cooldown or quote validity checks.
Accepted unchanged contracts do not repeatedly alert after five minutes. A fresh
negative price followed by a new positive observation rearms; stale/missing data
does not. New contracts/events respect the fixture hold. Unknown transport outcomes
retry only after the hold and a newer valid observation. Stable fixture tags avoid
stacking duplicate visual notifications where the platform supports replacement.
Exactly-once physical display is not guaranteed by Web Push; service acceptance
and actual phone display are separate acceptance items.

Existing validation still applies to legacy Goal/GAP signals. New pricing
notifications are tagged experimental and retain their model/quote provenance in
the delivery reference. This release does not claim settled entry profitability
or add a new outcome collector.

## Preferences and interface

Separate HT, FT Overview and FT V2 checkboxes; retain user Goal/GAP thresholds
and toggles. Subscription, native subscription, settings and status preserve the
new choices. Native H1 legacy threshold is retained for compatibility/hot scheduling,
but is not an additional HT pricing gate. No installation automatically turns the
scanner on. Push links open the matching existing tab and fixture; FT V2 honours
the linked fixture instead of silently showing its first ranked row.

Only four existing Mobile assets change; fifty are byte-identical. All original
model calculations, HT controller/session storage, HC pricing, scanner modules,
TOP logic, service worker and Desktop stay intact.

## Verification and operational limits

Local: 14 delivery/model/integration groups, 7 preference cases, existing HT model
and contract suites, FT state model suite, HC settlement suite (550 cases), syntax
for all 17 classic scripts. The deployed scanner replay verifies a priced early HT
delivery without a legacy H1 crossing, unchanged five physical fixture/feed calls,
durable restart dedup, and zero work when OFF.

CI: build actual deployed packages; candidate/published six-tab browser checks at
320/375/390/1280, scan-control regression, independent preferences, both Wrangler
dry-runs, full static hash checks, binding/rollback/desktop/OFF guards. Runtime
check is capped at one LIVE API call and one test Push to a unique enabled Apple
subscription. It never enables scanner or creates a cron. Temporary helper is
authenticated and removed after use; no keys or subscription endpoints are logged.

The last observed LIVE discovery failure was `API_PROVIDER_RATE_LIMIT`. This
release does not claim to fix that provider request failure or to demonstrate
real fixture-to-phone delivery while LIVE source data is unavailable. Exact runtime
outcome, deployment versions and Push acceptance are stored in the release artifact.
Physical phone display still needs user observation.
