# Football Edge — FT V2 non-regression release guard, 2026-10-23

## Reason
HT valuation assets disappeared in a prior Mobile Outbox static-assets deployment: the release path packaged 18 files, omitting 10 existing `ht-candidate/` pricing modules. Cloudflare Workers static asset deployment replaces the bundle rather than preserving omitted assets. HT recovery independently restored **28** files (10 HT restored, 18 preserved), production Mobile Worker version `65c59ebd-fbe5-4aae-91ef-fd3b0b097162`. This was an **asset packaging failure**, not evidence that FT prediction logic overwrote HT calculations.

## Concrete latent risk discovered in FT draft branch
Before this checkpoint, `mobile-outbox-candidate/production-preflight.mjs` still held the legacy **18-file** release list. Its corresponding `production-release.mjs` trusted the manifest and could upload an incomplete asset directory if someone repinned its old release assumptions. Existing version pin was stale and offered partial protection, but an explicit 28-file inventory invariant was absent. No accidental Mobile deployment observed from these changes.

## Patch implemented *on draft FT branch only*
- `ft-audit-fix/mobile-asset-isolation.mjs`: canonical 28-asset preservation contract (10 HT + 18 existing), no duplicates/missing modules, SHA-256 checks for manifest entries, and FT asset-scope audit refusing silent edits to HT pricing, `ui-tabs/`, push worker, icons and archived HTML. `index.html` changes require explicit separate approval; pure FT namespaced assets may be added without deleting preserved paths.
- `mobile-outbox-candidate/production-preflight.mjs`: reuses canonical complete 28-file list and verifies manifest hashes before constructing a deployment.
- `mobile-outbox-candidate/production-release.mjs`: verifies complete 28-asset package immediately before any external deployment action, refusing incomplete upload/rollback packages.
- `ft-audit-fix/test-mobile-asset-isolation.mjs`: **20** targeted regression checks covering the exact old 18-file omission, deleted HT files, modified HT pricing/UI, shared tabs, push service worker, modified index without approval, malformed hashes, and full 28-file candidate.
- `.github/workflows/ft-audit-foundation.yml`: runs guard tests in the full FT candidate suite and includes old release scripts as monitored paths.

## Independent CI
- [FT full candidate, including safety guard, PASS](https://github.com/Phuongdien1989/-football-edge-background-watch/actions/runs/39898681363) at commit `36d506ec313f4514668ab0ee6f02f68e8701316c`.
- Guard output: `FE_FT_MOBILE_HT_ISOLATION_PASS {"tests":20,"protected_assets":28,"ht_assets":10,"deploy":false,"scanner_actions":0,"d1_writes":0,"production_files_changed":false}`.
- Existing `Football Edge owner-approved Mobile Outbox ONLY release` workflow runs for the script edits were **SKIPPED**, due to release gate requiring a dedicated owner-approved commit message. No production Mobile deployment, D1 write, scanner activation, or HT/HC logic adjustment from these changes.

## Boundaries / release conditions
1. No guarantee of zero HT/HC impact merely from test PASS: FT and HT/HC still share the scanner, API daily budget, D1 Free account, and some persistence/push infrastructure.
2. Future actual FT V2 production approval must check active Mobile backend versions, full current 28+ asset closure and SHA-256 parity from *current production*, before deploy. Do not reuse the historical old version pin or 18-file backup path, or overwrite today's verified package.
3. Require independent H1/HT, HC, existing FT, TOP and Push non-regression both FT flag OFF and ON, plus account-wide D1 and API accounting; restore/rollback all targets separately.
4. PR #16 stays DRAFT; FT experimental model only, not calibrated for recommendations. FT release/merge/scanner start remains prohibited until explicitly approved.
5. Resume FT model-validation path: the new production schema inspection on [39887394112](https://github.com/Phuongdien1989/-football-edge-background-watch/actions/runs/39887394112) reported `REQUIRED_REPLAY_TABLES_ABSENT` under current contract. Need real provenance-clean predecision/Outcome cohort without harming D1 or other engines.

**Decision:** FT development may continue in the isolated draft branch. Production HT/HC remains untouched; actual production acceptance and browser/iPhone user-side checks are still separate gates.
