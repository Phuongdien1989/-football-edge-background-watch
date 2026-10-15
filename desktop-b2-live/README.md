# Football Edge Desktop B2 — isolated test

This is an **additive test frontend** built from the exact existing phone production HTML, SHA256 `aa4f0f6318cd52c14ff62b195c5ea04c5267107455924da44c9aa78169fe7f28`, plus two B2 assets. `build.py` refuses any other baseline.

The existing native app is the engine of truth. Fixture projection uses `window.FE_B2_NATIVE` inside original closure. Ranking/entry uses existing `window.FEAddonBridge.masterRows()`; B2 never calls `renderMasterOpportunityBoard()`.

Live backend access requires configuring API key/background Worker URL and token **inside this test origin**, not via repository or URL. Scan Control is shared across all clients; the B2 button needs a real status report before activation and confirms user intent before changing it. No automatic scan, push test or new networking loop is added by B2.

Workers asset deployment name `football-edge-desktop-b2-test` is distinct from phone Worker `shiny-silence-d892`. There is no Cloudflare D1 binding and no backend proxy in the test Worker.

Manual tests still required for API-connected scans, DEEP, COPY, ON/OFF with deliberate consent, Push and cross-device consistency. Do not merge or deploy to mobile production without separate authorization.
