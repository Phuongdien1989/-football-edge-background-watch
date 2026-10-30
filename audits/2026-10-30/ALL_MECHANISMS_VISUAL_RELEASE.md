# Shared approved visual design for remaining Mobile mechanisms

User authorized applying the approved HT visual style to the remaining mechanisms in the shared experimental app. Continue from b15d0e818d8d686ee7d4ab6149dc0f132de9b3b8 and verified Mobile version 39c5f683-9ca5-4931-b3c1-5bfb9f8e1519.

## Scope and semantics

- Overview, FT Goals and FT Overview share a compact match card, data tiles, source SOT history, separate data/market reading, existing decisions and collapsed explanations. The first source fixture is a display default only. Existing assigned TOP ranks remain assigned ranks; unranked entries are labeled list positions.
- FT AI V2 exposes the already-assessed exact-line full-win probability, current quote/Fair/EV and original five-minute session. Original settlement, comparisons, warnings, source evidence and sensitivity remain expandable. Current data guards hide numeric main-card values on blocked/stale inputs.
- HC presents three FT match-result probabilities explicitly distinguished from handicap-win probability. Unverified settlement remains RULE_WAIT; hypothetical valuations remain inside details. Verified two-sided research values remain identifiable as research and do not generate a recommendation. Original/current research references and deadlines remain intact.
- No legacy score or GAP becomes a probability. Missing values stay missing, real zeroes remain valid. No new team-pressure or positional-tracking data is invented.

Only four existing presentation assets change, adding one pure shared visual module: 50 complete static assets, 45 existing assets unchanged. Every HT asset, entry HTML, model, adapter, session controller, ranking, scanner, backend, D1, Push and Desktop asset stays unchanged. There is no schema migration or scanner activation.

## Release evidence

Run pure view regressions and actual app-shell browser QA at 320, 375, 390 and 1280 pixels with detached synthetic read-only bridge inputs. Verify every tab, fixture selection, exact probability labeling, collapse behavior, source order, FT original/current price and goal invalidation, HC rule/cooldown/source guards and HT ten-minute retained quote. Capture both compact cards and full screens. No provider/API/D1 calls are permitted in browser QA.

Before publishing preserve the entire active static bundle and version metadata; dry-run the full 50-asset bundle. After publishing verify all public hashes, browser behavior and backend/Desktop/scanner state. On owned deployment failure restore the exact prior Mobile version and verify original hashes. Synthetic rendering does not establish real phone Push delivery, prediction accuracy or current provider health.
