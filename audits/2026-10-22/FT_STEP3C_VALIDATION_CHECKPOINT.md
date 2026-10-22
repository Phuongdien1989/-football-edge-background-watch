# Football Edge — FT AI V2, Bước 3C evidence and replay checkpoint

Date: **2026-10-22**. Scope: **PR #16 Draft only** (`fix/ft-foundation-20261021`). All production components retained. No merge, deploy, scanner toggle, real provider call, production D1 writes, schema migrations or production TOP/Push changes.

## Acceptance by workstream

| Task | Implemented and tested | Evidence scope | Release acceptance |
|---|---|---|---|
| **3C.1 Data Integrity** | Pure `replay-integrity.mjs`: validates identities, captured/received/source clocks, score and final-time leakage; preserves missing stats as REVIEW | 15 unit tests **PASS** | Production and provider/source age **NOT VALIDATED** |
| **3C.2 Smart Recorder** | `capture-plan.mjs` fair round-robin admission with bounded priority seats; opt-in trial Worker stores last 16 candidate-plan manifests in its DO storage, defers excess before recording, leaves original FT/Notify untouched | 8 unit tests and transformed trial Worker integration **PASS** | Cross-tick/DO storage and real snapshot coverage **NOT MEASURED** |
| **3C.3 Outcome Replay** | Uses existing append-only OBSERVATION→DECISION→OUTCOME and `replay-coverage.mjs`; corrections preserved, ambiguous/missing links separated; no accuracy guessed | Existing ledger/outcome/replay integration **PASS** | Historical recovery and live final-fixture pairing **NOT VALIDATED** |
| **3C.4 Validation Report** | `replay-validation-report.mjs`: reports accepted/review/reject, linked/missing decision/outcome, explicit deferred fixture counts, source age UNKNOWN, null accuracy/ROI | 8 report tests **PASS** | Only synthetic cohort, no real-fixture accuracy assessment |

New specific 3C checks: **31 PASS** (15 integrity, 8 capture planner, 8 report); the expanded full candidate CI is PASS.

CI run at candidate head before this report:
https://github.com/Phuongdien1989/-football-edge-background-watch/actions/runs/39740486255

## How the trial Worker capture planner behaves (default OFF)

- Normal scanner/FT legacy continues regardless of replay recorder results.
- Only when `FT_REPLAY_TRIAL_ENABLED==='true'` the *separately generated recorder-trial variant* reads a DO capture-plan cursor and writes a bounded history of the last **16** batch plans.
- The plan uses the existing scanner's `batch` up to **12 matches**; covers `2H` fixture IDs only. It does NOT initiate new scans or provider requests.
- A candidate pair costs up to **8 SQL** in the previously measured isolated remote D1 path. SQL cap remains **24 replay-sidecar executions per invocation**. When outcome discovery is enabled, the plan reserves 5 SQL slots, giving at most **2 new observation+decision pairs** per nominal invocation; when disabled, up to **3 pairs**. Actual prior replay SQL usage can lower these values.
- The current trial hook passes `priority:false` for every fixture: **unbiased round-robin coverage**, not a claim that the old Watch Score is validated for investment prioritization. The pure planner additionally supports a bounded priority cohort for future evidence-based sampling.
- Deferred fixture IDs are written to a DO manifest *if that write succeeds*. They are **not reconstructed** as historical snapshots from later market data. A failed DO manifest write causes a fail-closed replay plan; scanner remains unaffected.
- Even selected fixtures may fail to persist because of D1 quota/timeouts; the plan records admission, **not confirmed durable success**. There is no complete per-tick observation+decision atomic transaction.

## Strict distinction: lineage vs forecast calibration

The independent report counts `LINKED` rows (valid ID and chronology join), but sets `accuracy:null`, `roi:null`, `calibration:null`, and `push_delivery:'NOT_OBSERVED'`. A NOT_EVALUATED result is never treated as a losing pick. Missing odds, source timestamps and statistics remain distinct from hard invalid identity/future timestamps. No AI fair probabilities or investment VALUE/VERIFIED VALUE claims are generated.

## Key open blockers — MUST NOT release

1. **Full D1 Free workload**: existing app D1 + new recorder operations together are not metered across actual Worker/DO invocations. The 24 replay-only SQL cap does not certify the 50-query Workers Free limit or account-wide daily row usage.
2. **Historical cohort coverage**: deferred snapshots lack actual prices/statistics at the skipped receipt time; cannot be backfilled honestly. Need bounded real cohort measurement, selection denominators, and reject or measure selection bias.
3. **Partial records**: the existing collector writes OBSERVATION then DECISION separately; atomicity/ recovery under a partially exhausted SQL budget requires follow-up. Incomplete records are not usable forecast training labels.
4. **Unknown provider source timestamps**: `received_at` is available; `source_at` is often null, so data age is UNKNOWN and never certified from receipt alone.
5. **Real outcome matching**: FT/AET/PEN regulation score resolution is unit-tested but not certified on independent finished fixtures from production.
6. **Validation reporting**: 3C tests are synthetic/mock; must not be mistaken for empirical calibration, ROI or Push delivery metrics.

## Proposed next checkpoint

Do **not** merge PR #16 or enable replay in production. Obtain bounded, owner-approved Worker/DO+D1 end-to-end measurements in **isolated runtime**, alongside quantified deferred/successful capture coverage, before release. Only after this should FT AI V2 Over/Under odds pricing use replay records for empirical confidence assessment.

Code references:
- `ft-audit-fix/replay-integrity.mjs`
- `ft-audit-fix/capture-plan.mjs`
- `ft-audit-fix/replay-validation-report.mjs`
- `ft-audit-fix/patch-recorder.mjs`
- `ft-audit-fix/build-recorder-trial.mjs`
- `ft-audit-fix/test-replay-integrity.mjs`, `test-capture-plan.mjs`, `test-replay-validation-report.mjs`
- Previous remote D1 evidence: https://github.com/Phuongdien1989/-football-edge-background-watch/actions/runs/39699252168
