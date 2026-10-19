# Saved provider diagnostics checkpoint — 2026-10-18

## Verified state
- Original backend version: `2be01a61-cc5d-43c7-9c6d-13e581296453`.
- Original backend source: `3c97629e51251c56f9edeb8d0f67a7a0dad957a2`.
- The final guarded diagnostic rollout failed its visibility gate and restored the exact original backend. Rollback PASS.
- Mobile version `03c1d55d-358a-448b-96f3-f356704831df` and Desktop version `a332ee39-abb2-422d-a021-db78ef19cc10` were unchanged at preflight and after upload.
- Scanner OFF; no alarm verified through health on original source after restoration.
- Diagnostic code requested zero football provider calls and zero production D1 writes. This does not assert zero unrelated account activity.

## Changes and results
PR #10 contains only one runtime diagnostic import/field, its sanitizer/test and guarded release tooling. Removing that import/field reconstructs the original module byte for byte. Local and CI sanitizer/roundtrip checks PASS. No engine, threshold, frontend, scanner, API pacing or D1 schema changes.

1. Run [39118827885](https://github.com/Phuongdien1989/-football-edge-background-watch/actions/runs/39118827885): preflight and settings comparison PASS; temporary RPC bridge did not return new field; restoration was initially unconfirmed by the immediate check; bridge deleted.
2. Run [39118934259](https://github.com/Phuongdien1989/-football-edge-background-watch/actions/runs/39118934259): exact original version/source restoration verified PASS.
3. Run [39119008067](https://github.com/Phuongdien1989/-football-edge-background-watch/actions/runs/39119008067): preflight, dry-run and unchanged settings/clients PASS; production health did not expose new DO field within bounded propagation check. Error `DO_DIAGNOSTIC_ROLLOUT_NOT_VISIBLE`. Original version/source restored, rollback PASS.

No diagnostic version remains approved as the active release. Do not label this provider issue fixed.

## Unresolved blocker
Why the existing Durable Object diagnostics still expose the old shape after a verified Worker upload is not established. Check namespace ownership/class/version routing and the actually bundled export before attempting another release. Do not infer an IP block or require a paid plan from the generic rate classification.

The latest successful stored provider observation read during this task had daily limit 75,000, remaining 53,861, minute limit 450 and remaining 449. A nearby failed observation had HTTP 200, rate-limit classification and no quota headers. The complete provider error text remains unavailable. These observations do not prove the full API account is out of quota, nor establish which network/account mechanism rejected the other request.

## Earlier central measurement checkpoint remains intact
PR #9 commit `f025cc33c86517be7ce5c14696fbe0b69951afcc`: raw final results saved for two fixtures; 122 unique fixtures pending. Central measurement remains staging-only. Do not repeat completed calls or present the incomplete two-fixture subset as the global profitability result. Existing paper audit does not establish stable profit for H1, FT or HC.

## Resume
Start with this report and PR #10; do not redeploy merely to repeat the same visibility check. First investigate the actual production DO binding/export routing read-only and the dry-run bundle. Keep scanner OFF unless the user turns it on. Preserve original UI, FREE plan and rollback. No extra user action has yet been identified that would resolve this diagnostic blocker.
