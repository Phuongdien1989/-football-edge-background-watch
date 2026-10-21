# HT event repair checkpoint — 21 October 2026

## Deployed

- Mobile code: 319558534e1bac39dd9d212afd22ecf1c818bf22; version 3166663f-f039-48f5-92ae-888890bb9455.
- Mobile event workflow PASS: https://github.com/Phuongdien1989/-football-edge-background-watch/actions/runs/39550924531
- Event acceptance audit PASS: https://github.com/Phuongdien1989/-football-edge-background-watch/actions/runs/39550924585
- Existing source regression PASS: https://github.com/Phuongdien1989/-football-edge-background-watch/actions/runs/39550924844
- Backend code: 15069125837d22f292a04bf111f0f569037793b5; version 7e4bb3b7-2dc6-4f0d-8c8a-9d8e6da2440a.
- Backend workflow PASS: https://github.com/Phuongdien1989/-football-edge-background-watch/actions/runs/39551380943
- Desktop remains a332ee39-abb2-422d-a021-db78ef19cc10.

Mobile publication changed only the scoped event functions inside index.html; the HT card, league label and model assets were preserved. Server publication changed only HT resetType and its correction cooldown selection inside worker_notify_v130.js. Runtime bindings, D1 database, scheduler policy and prediction/Push thresholds were preserved. Backend health, source version and scanner OFF/no alarm were verified after deployment. No live provider requests or phone notification tests were initiated by these releases.

## Preserved recovery

- Immediate Mobile rollback: 0449307e-c464-4959-82b6-c4825789e568.
- Immediate backend rollback: fe5c9fb5-ae1d-4aa6-8850-8cbdeb2b8e73; source 76eae2e373138adeb0acaa0fff567b784ecd5016.
- Mobile backup artifact: https://github.com/Phuongdien1989/-football-edge-background-watch/actions/runs/39550924531/artifacts/12323148862
- Mobile release proof: https://github.com/Phuongdien1989/-football-edge-background-watch/actions/runs/39550924531/artifacts/12324211175
- Backend backup artifact: https://github.com/Phuongdien1989/-football-edge-background-watch/actions/runs/39551380943/artifacts/12323388608
- Backend release proof: https://github.com/Phuongdien1989/-football-edge-background-watch/actions/runs/39551380943/artifacts/12323383781

Artifacts retain 90 days. They are source/assets, not database dumps or secret backups. For a coordinated full pre-repair restore, restore backend to fe5c9fb5 first while retaining Mobile 3166663f, verify health/scanner OFF, then restore Mobile to 0449307e. Existing ownership/version checks intentionally reject rollback after an unrelated later deployment. Re-read active versions before any recovery; do not force through a mismatch.

## Next stage and actual prerequisite

Shared decision-contract source and ten deterministic tests are prepared, not active. It keeps independent HT pricing, legacy TOP ordering and actual device delivery settings explicitly distinct; an old score threshold must not be silently reinterpreted as model probability.

Before changing the notification/ranking policy, observe the repaired baseline in a real user-controlled scanner session and verify phone delivery. The user's standing preference requires manual scanner enablement; these releases leave it OFF. A WebKit simulation is not proof of an iPhone/PWA subscription, current provider quotes, receipt of a real notification or forecast accuracy. Do not claim those acceptances, invent outcomes, enable scanning automatically or request a paid upgrade to bypass the remaining verification.

The full HT mechanism is still a research trial. Event defects HT-A01 and the Mobile/server correction paths of HT-A02 are repaired and tested. New price-based TOP/Push activation, durable new-model outcomes and live-pressure calibration remain subsequent scope after real observation, not completed production features.
