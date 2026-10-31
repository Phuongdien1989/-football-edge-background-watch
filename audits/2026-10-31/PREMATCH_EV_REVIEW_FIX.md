# PRE-MATCH EV review and card correction — 31 October 2026

Trigger: screenshot fixture 1528753, Nanjing City–Dalian Huayi, showing away model probability around 44.1%, Bet365 odds 7.50, fair odds 2.27 and EV over +230%. The screenshot alone does not prove the 7.50 quote is assigned to the wrong team. The mathematical EV is consistent with that probability and price; it does not establish a profitable real-world opportunity.

Code issue identified: raw EV selected research candidates, and explicit quote confirmation could produce OPEN_TRIAL for the limited recent-history fallback even though its opponent adjustment, home advantage and calibration remain absent. Rule/price verification is distinct from model verification.

Changes:
- Preserve forecast identity, probability, fair odds, and EV math. No odds-derived adjustment or EV cutoff/cap.
- Limited recent-history fallback requires model review. Quote confirmation alone cannot produce OPEN_TRIAL for it. Candidates remain visible and ranked as research, so the user can observe experimental outputs.
- Show a same-source matched-bookmaker, period, market and snapshot benchmark where complete. Normalize 1X2 or half-line OU reciprocal odds to remove proportional overround for comparison only. Quarter/whole-line Asian markets are not treated as binary probabilities.
- Show model probability, market benchmark where available, and binary breakeven separately. Missing complete quote set stays missing. Raw source labels and source fixture identifiers are retained for diagnostics/export.
- Reject an odds response that names a different fixture instead of relabeling its quotes as the requested fixture.
- Reduce card headings, prevent price/EV overflow, and use the card container width for stacking the analysis columns. Preserve the Light Signal Pro palette and existing tabs.

Source: 80cb7a6a021a64474d8ad7a5f18bdb4770aa78e2 on feat/prematch-one-shot-scan-20261031, Draft PR #36.
Acceptance workflow: https://github.com/Phuongdien1989/-football-edge-background-watch/actions/runs/41176729103

Local PASS: existing 21 model groups, 3,724 settlement reference cases, cache/confirmation and collector guards. New regression reproduces +230.405% theoretical EV, verifies exact HOME/DRAW/AWAY mapping, rejects mismatched source fixtures and unmatched source/time quote sets, checks that changing odds leaves forecast identity/probabilities unchanged, and ensures confirming price cannot bypass limited-model review.
Browser acceptance uses mock provider responses, not a real account key. No new real-provider diagnostic calls were requested for this correction.

Production predecessor and rollback: c495503f-89a1-4a92-90b1-610f7d029345. Backend expected fcf19574-3498-4ef3-9d08-d9fb575df365 / source 7c22543d019cbec05026974b0f3e43df39ee44a1. Desktop expected a332ee39-abb2-422d-a021-db78ef19cc10.

Unresolved: actual source odds for screenshot fixture were not independently obtained; the historical fallback has not been retrained or calibrated. These changes correct model/quote approval semantics and presentation, not forecasting accuracy. Training and validation require suitable real historical data. Do not claim +230% as a validated edge or this patch as improved predictive accuracy.

## Final production acceptance

Mobile version: 0f029118-cf5b-456a-bffa-49902f4aa559, 100% traffic, VERIFIED.
Source: 80cb7a6a021a64474d8ad7a5f18bdb4770aa78e2.
Workflow 41176729103: PASS. Candidate and published browser checks cover 320/390/540/900/1440px, price text bounds, compact headings, source comparison, explicit quote confirmation without model-approval bypass, scan continuation and cancellation. Existing HT/FT/HC and native controls also PASS.
All 69 public asset hashes verified; only the eight PRE-MATCH files listed above changed. Backend source, scanner enabled state and control timestamp match before/after.
Artifact: 13033491680, prematch-scan-release-evidence, SHA256 1fe7bf5aa36536ae156a0ca3e9f842602b57b9d5b0d79622b1822e445e8342c5.
Rollback preserved: c495503f-89a1-4a92-90b1-610f7d029345.

No additional real provider calls, D1 writes, scanner changes or Push sends were requested. This is not a calibration result or independent confirmation of the screenshot bookmaker quote.
