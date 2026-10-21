# HT shared decision contract — staged, not activated

The event defects are repaired separately from prediction/delivery changes. A shared pure `HT_DECISION_CONTRACT_V1` record now gives future card, ranking and delivery adapters the same fixture/observation/score/HT contract, independent forecast, matched quote, price EV and explicit consumer policies. It preserves missing device-setting information as unknown instead of assuming that an old 72/100 pressure threshold is a 72% model probability. Whole/quarter lines are not represented as binary event probabilities. Tests cover stale data, missing history/quote, negative value, source identity, nonmutation and delivery-policy separation.

This module is prepared source only; it is not wired into production. Legacy TOP/Push is still intentionally preserved. A positive-value research card must not be described as a notification trigger from this new model. Activating that trigger requires a separately versioned subscription preference and actual delivery test, not silently reinterpreting the existing H1 point threshold. Existing scores are not probabilities.

Remaining activation work:

1. Thread the shared contract into backend runtime and the Mobile bridge without new polling or duplicate D1 writes; preserve observation/quote provenance and expose real per-device policy.
2. Add an explicit optional HT research-price notification policy; preserve the existing legacy HT signal preference and rollback. Test original contract, deduplication, restart, event invalidation, delivery retry and notification expiry together.
3. Decide the HT attention ladder consumer independently of Master/FT/HC. Keep five distinct fixtures and record rank transitions without treating unvalidated EV as established accuracy.
4. Verify on a real user-controlled scanner session and iPhone/PWA. Scanner stays OFF in these releases; no genuine LIVE/PUSH acceptance or measured forecast outcome is claimed while that prerequisite is absent.
5. Capture immutable original recommendations and actual HT outcomes for calibration/value validation before altering the forecast. Do not invent live-pressure weights or future outcomes to obtain a PASS.
