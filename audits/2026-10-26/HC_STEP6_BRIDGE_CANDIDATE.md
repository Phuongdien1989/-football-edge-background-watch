# HC — existing bridge integration and exact source audit (2026-10-26)

Continues d2ae4174c5230b34258710b606a68b174bdd12dc on draft PR #25. Candidate only; no production deploy or Cloudflare credentials.

## What changed

- Additive research panel in the real Mobile shell's HC tab, explicitly enabled only by `?hcResearch=1`. Original HC panels, original tools and six-tab navigation remain. Other mechanisms and their assets unchanged.
- Uses existing `FEUIReadBridge.read()` and `FEOverviewInputBridge.read()` (DEEP histories). No request to fill missing context; missing history remains MODEL_WAIT.
- Uses actual displayed HC list IDs/order from `FETabsIntegrated.read()`, maximum five distinct IDs. Shows selected fixture, or first fixture on list route; no five long cards, no new rank or cross-engine selection.
- Reads existing `FEOverviewInputBridge.readControls()`. Production list bridge intentionally omits cooldown/reset fields. An absent list cooldown must not be interpreted as unlocked. Aggregates controls conservatively and blocks quotes older than reset. Failed controls read blocks valuation.
- Exact original quote survives adapter. Source audit displays feed/book identity, market ID, HOME/AWAY signed lines and giving side, quote timestamp/provenance, observed score and separately provider-supplied score. HUB_RECEIPT is explicitly not provider update time.
- No source-specific verified rules installed. A quote's own `basisVerified` flag cannot verify the registry. Unknown basis stays RULE_WAIT with collapsed hypothetical valuations; no actionable recommendation or Push.
- Event updates coalesced with requestAnimationFrame. Reads only while HC panel is visible; UI refresh every 15 seconds or at the earliest model/quote expiry. One cheap timer checks due time; does not run a provider/scanner schedule. Preserves expanded details for the same fixture, clears removed fixture and hides panel outside HC. Destroy removes observers, listeners, panel and timer.
- Opt-in loader is the only modification to existing index.html. All 35 other baseline assets byte-identical. Nine HC module/style assets added; complete 45-file candidate package prepared from verified release artifact.

## Baseline provenance

Production source checkpoint c8182745b3b01f678cac92cf62720f4bda007ec9, released Mobile version 24036780-fc63-46e0-a4b9-bf9f9d70c39a. GitHub run 40266648827 artifact `hc-exact-quote-release-proof` (12626488620). Candidate build checks every baseline asset against the release manifest, then adds the opt-in loader and HC files. This is reproducible packaging, not a fresh assertion that Cloudflare's active version has not changed.

No backend, D1 schema, original HC/HT/FT logic, Push, ON/OFF, scan interval or production rollback changes. Legacy HC ranking is not recalculated. The visible list is used as-is; no claim that the pool ordering is the separately sorted native `hcTopItems()` order.

## Tests and limits

Source tests cover controls/reset, missing context, quote provenance, fixture order, read failure, rule boundaries and no network/persistence/setter code.
Real app shell browser tests at 320/375/390/1280 use detached synthetic bridges, actual production HTML/modules from pinned baseline, and block all API/non-GET/external requests. They test HC selection, source contract display, odds updates, unchanged model Fair Odds when only odds change, collapsed states retained, event storm coalescing, cooldown, stale data, disappearing fixture, missing DEEP context, opt-out behavior. HT five-minute session/ten-minute retention and FT V2 score/time/pricing regressions also run.

No live provider data, real phone Push or production HC model performance is certified. Scanner stays under user control. Missing settlement evidence is a remaining prerequisite to actionable HC pricing, not an assumed API restriction. No dedicated IP or paid upgrade proposed.

## Next work

Review integrated candidate; validate exact source settlement evidence; then implement five-minute original/current research session and explicit goal/red/phase/contract invalidation. LIVE calibration and performance measurement require data and separate evidence; no invented pressure/xG weights. Production deployment requires complete asset/hash/active-version preflight and rollback preservation; no deployment action is supplied by this workflow.
