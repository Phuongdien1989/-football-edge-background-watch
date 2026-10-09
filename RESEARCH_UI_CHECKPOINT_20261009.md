# Research cards collapsed on production

User authorized hiding Final Model Decision and Market-Time Intelligence on 2026-10-09.
Both FT and H1 render templates now put these two cards inside the existing closed
`details.mt-model-details` element, labelled `CHI TIET NGHIEN CUU`.
Original styles, research computations, validation persistence, notification worker,
scores and thresholds remain unchanged. R2 is excluded.

- Deployed commit: d3d277956f4fda0e3d05c883becf27dabe78c30b
- Frontend: https://shiny-silence-d892.ngophuonghuy.workers.dev/
- Frontend version: 8ccef0ff-21eb-4ab1-abfc-247390f6ac42
- SHA256: 1c6cbda706e7448159c459e7bb2d792f02ab3a95de44bba437be7facbfa1251a
- Immediate rollback frontend version: 9b5bb5f1-fb53-4a54-9825-b0850ea28074
- Original pre-sync production source remains in sync-fix/rollback/index.html.
- Backend unchanged: 491076a2-78d9-48f0-9050-ffc0f479c531
- Successful deployment/test run: 37895835758, attempt 2, job 113707522695

Regression passed in actual WebKit at widths 390, 375 and 1280: closed research
cards, opening the disclosure, canonical state synchronization, ordering, stale
guards, offline suppression and no JavaScript errors. Worker tests passed.
Production HTTP source/assets checks passed. Production WebKit sync passed with
3 real 2H snapshots (FT and HC); missing-stat scores remained absent.
Physical-device push clicks are still not independently verified.

First draft assertion ran before card rendering and was fixed before deployment.
First deployment attempt with corrected tests timed out during WebKit startup;
no deployment occurred. Re-running the same commit passed all checks and deployed.
