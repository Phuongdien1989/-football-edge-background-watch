# Overview LIVE controls — native scanner coordination

User approved a compact control strip above Overview TOP 5: Start LIVE / Pause, one-shot Scan now, current state and HT/FT/HC shared source. Continue from integration fc018b9f3a0fbb8040027763db59294df3750842 and Mobile c4f6f781-5d5b-4d02-b12d-e4e0cfea2a2b.

## Real wiring

Existing CHECK SCAN NOW only reads /api/notify/status. It is not a one-shot scanner. The new Scan now calls existing startUnifiedLiveScan(true), which reuses the shared LIVE catalog and the same H1/FT/HC engines. Its original function bytes, engine selection/ranking, adaptive timing and prediction code remain unchanged.

A scoped classic-script adapter exposes the existing scanner closure through a small coordinator. Start explicitly enables the existing authenticated /api/notify/scan-control and native AUTO checkboxes, then runs the original unified scanner. Pause stops all three local loops and requests background OFF. Existing manual scan budget, API caps and peak-window policies remain enforced by the unchanged backend. Source errors and missing keys are visible.

A one-shot from local OFF temporarily disables native AUTO checkboxes, awaits one unified cycle, stops the resulting local loops and restores prior checkbox preferences. It never requests background ON. If local AUTO was already running, existing cadence is preserved. If remote is already ON with local OFF, one-shot preserves remote ON without starting local AUTO. The inherited backend full-pause ensureAlarm guard prevents fixture registration from waking a manually paused scanner; this source was inspected, not modified.

Pending operations disable repeated clicks. Unknown/expired state is not presented as OFF or green LIVE. Failed remote stop is visible and cannot claim background stopped. Failed local startup rolls back the remote enable attempted by that action. Status responses started before a control write are discarded using a local control epoch, so an older GET cannot reverse an acknowledged POST in the UI.

## No extra scanner

No new scanner timer or periodic status poll is added. Existing heartbeat status polling is reused. DOM/event updates refresh only the stable control panel. Scanner operations happen only on explicit user action. Installing the feature does not start any scan. Local and background runs still use their existing paths; no new parallel per-mechanism scanner is introduced.

## Packaging and validation

Commit a small deterministic host patch against the exact prior full static bundle instead of duplicating the 1.36 MB entry HTML. Three existing assets change (index bridge/status instrumentation, tab entry import, additive CSS); two modules are added. Complete package: 54 static assets, 49 existing assets identical. All standalone HT/FT/HC model/session/view assets, TOP, D1/backend and Desktop stay unchanged.

Unit checks cover start/stop ordering, single-shot OFF/ON, duplicate clicks, missing key, rollback on failed startup, remote-stop failure, preference restoration and truthful quota/unknown/source-error states. Host checks verify original unified scanner bytes and timer counts unchanged and parse every classic inline script.

Real app-shell browser tests at 320/375/390/1280 cover all previous mechanisms, then exercise actual private scanner adapter bindings with QA-only in-memory provider/remote stubs: OFF one-shot, acknowledged ON/OFF, duplicate guard, old GET race, failed stop, failed local scan, Free budget display, tab switching and stable panel. No real provider requests, Push or scan-control writes are executed by release QA. Published hash checks use the unmodified public response before/after the QA interception. Verify backend/Desktop/scanner state unchanged and preserve exact prior-version rollback.
