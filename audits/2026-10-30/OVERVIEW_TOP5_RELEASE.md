# Approved Overview TOP 5 mobile dashboard

User approved the five distinct compact match cards, white/pale blue/navy/emerald visual concept. Continue from integration 46e3c5fd804f5f25aa86b7909f3b3ce8b4c7f14c and verified Mobile version 39ac2294-93ed-475a-96e6-0ae37c618557.

Overview now displays up to five existing source-ranked fixtures, league/score/phase, source SOT history, separate data and market labels, HT/FT/HC state pills, and current assessed recommendations with Fair/EV when exposed. Only actual assigned ranks appear as TOP; missing fixtures are never fabricated. The green TOP 1 frame denotes the existing rank, not an invented prediction guarantee.

Inline expandable detail is keyed by fixture ID and survives refresh. Links open the original HT, FT, HC or FT Overview mechanism. All other tabs retain their current layouts and mechanisms. No scanner toggle, API request, polling, provider image fetch, model fitting, D1 write, Push or schema change is introduced.

## Truthful deviations from illustrative art

- Team initials are styled fallbacks, not invented official crests. SOT lines use observed timestamped values and explicitly say cumulative SOT; no momentum or pressure curve is fabricated.
- A source fixture with insufficient history shows a neutral missing-chart state. Empty TOP stays empty.
- HT quote summaries invoke the same existing assessHTItem code and a detached clone of the existing HT session book. No native session or persistence changes. This avoids requiring a prior HT tab visit and re-checks the original 55-second source/quote validity window on every existing UI refresh. No new model, thresholds or timer is introduced.
- FT quote summaries reuse the existing FT Overview assessment and exact action guard; source is labeled FT Overview. Native STRONG/GAP never becomes a % or an actionable handicap recommendation.
- A model/market mismatch is displayed separately. No recalculation of a new master probability or TOP ranking occurs. Source observations must align before sharing a quote on one match card.
- Scanner activity is not guessed from device connection. Header reports freshness of the actual displayed source, not an invented ON state.

## Verification and rollback

Pure tests cover source order, deduplication, capped size, missing/stale data, actual zeros, HT source/cache/session alignment, FT action guards, mixed scores/phases, immutable inputs, escaped names, expansion links and absence of I/O. Browser QA runs real app modules with detached synthetic read-only inputs at 320/375/390/1280: five match scenario, assessed HT/FT quotes, expansion retention, navigation, source removal, stale and empty states, plus all existing HT/FT/HC session regressions. Screenshots include full screens.

Release changes two existing presentation assets (tab host and additive CSS) and adds an overview renderer and read-only HT projection adapter: 52 complete static assets, 48 existing assets unchanged. All HT assets, FT/HC models/controllers/views, backend and Desktop remain identical. Preserve previous complete package and exact version as rollback; verify all public hashes and browser behavior after publication, restoring the owned deployment on failure. Synthetic QA does not certify actual phone delivery or betting performance.
