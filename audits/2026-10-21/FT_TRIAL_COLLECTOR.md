# Trial collector — 2026-10-22
Staged module only, not connected to the Worker or copied into its bundle. No deploy or production schema/writes.
Connects raw-input serializer to ledger adapter. Disabled by default; explicit attempt, record-size and session-byte limits required.
Snapshots inputs at capture time. Serializes writes within one collector instance. Reservations include duplicates and failures. Storage errors return RECORD_FAILED; callers must report this as missing evidence, not successful collection.
Tests measure SQL attempts with mocked D1, including errors: a new observation plus exact retry costs four SQL attempts and one INSERT attempt. No claim about billed rows.
Limits are in-memory per instance, reset on restart, and do not coordinate multiple instances. They MUST NOT be presented as a daily quota guard. Persistent budget reservation and actual Worker hooks remain required.
No sampling by recommendation or odds; caller chooses inputs. Future live integration must capture all selected scans, including rejected decisions, and retain receipt clocks without extra provider requests.
Local execution environment was unavailable; tests run in GitHub CI. No new production inspection was performed.
