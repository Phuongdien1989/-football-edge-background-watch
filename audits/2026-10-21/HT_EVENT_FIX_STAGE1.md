# HT event integration fix — stage 1

Addresses HT-A01 and the Mobile continuity portion of HT-A02 from the acceptance review. Source is based on audit checkpoint 709749de0aece4d4a333b6683e34d01e8b0993a1. Last production Mobile before this release is 0449307e-c464-4959-82b6-c4825789e568.

Event identity is now checked before requesting statistics and again before deduplicating a statistics observation. A known goal immediately updates the guarded score, invalidates cached market evidence and starts the existing two-minute goal cooldown without inventing a new statistical timestamp or appending a duplicate history point. Red-state changes use the existing three-minute cooldown. Decreased totals and changed score allocation are explicitly recognized as corrections. Repeated unchanged observations do not reset the deadline again. Older server snapshots cannot overwrite a pending known event.

The Mobile reset classifier delegates to the same pure event guard. New source tests cover goal increases, VAR reductions, same-total corrections, red increases/decreases, phase end, missing red counts, unchanged observations, session invalidation and a known goal arriving before duplicate or failing statistics acquisition. Existing session, collection and UI checks remain required.

Publication changes only scoped HT functions inside Mobile index.html, with reversible patch proof; all other deployed asset hashes, including the new card/league UI and model modules, remain unchanged. Production backend/FT/HC/Master/Push thresholds, scan cadence, scanner setting, schema, D1 and provider quotas are preserved. The previous complete Mobile asset set and its Cloudflare version are retained for exact rollback.

This stage does not claim server-side VAR integration, unified research TOP/Push, new-model outcome validation or a calibrated live-pressure forecast. Those require the next versioned decision-contract/backend stage and actual observations. Legacy Push is not silently replaced by a research probability model. No physical-device notification receipt is established by browser simulation.
