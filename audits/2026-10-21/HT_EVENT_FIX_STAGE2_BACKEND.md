# Backend HT correction consistency — stage 2

Mobile event guard deployed from 319558534e1bac39dd9d212afd22ecf1c818bf22 at version 3166663f-f039-48f5-92ae-888890bb9455. Its release/acceptance workflow 39550924531 passed, as did mechanism event audit 39550924585.

This backend stage reconstructs the exact previously deployed reviewed backend package a9e9cc68cc07af27bdca0305b6f227da12f64cb9 from immutable artifact run 39491133238, verifies every package hash, then changes only resetType and its HT cooldown selection in worker_notify_v130.js. VAR reductions, same-total score corrections and red-count corrections now reset server-side HT continuity using the same event classifier as Mobile. Score corrections use the existing two-minute goal cooldown; red corrections use the existing three-minute red cooldown.

No probability forecast, threshold, TOP policy, Push payload, FT/HC evaluator, database schema, scan rate or frontend asset is changed. Deployment requires exact current backend version fe5c9fb5-ae1d-4aa6-8850-8cbdeb2b8e73 and commit 76eae2e373138adeb0acaa0fff567b784ecd5016, scanner OFF/no alarm, preserved D1 binding and runtime binding signature. No permission is given to enable the scanner. Existing runtime variables and secrets are retained. Rollback restores that exact backend version.

Next acceptance scope remains a versioned HT decision contract and a real live/phone observation. Event-guard acceptance does not validate forecast probabilities, new TOP/Push unification or physical notification receipt.
