# Full original production rollback verified

This supersedes LIVE_ROLLBACK_CHECKPOINT_20261009.md and research UI checkpoints.
User requested full original restoration after LIVE scanning remained unavailable.

Verified 2026-10-09 14:30 Asia/Ho_Chi_Minh:
- Frontend original P2.0.5.2 version c1ab7df6-d13d-436c-a656-c42a547b3420.
- Public HTML exactly matches frozen original SHA256
  a82bf87e1db875fb975b94ac9b6df9e785818de37b7bb55fec6f290efca9c844.
- New FE_NOTIFY_SYNC_CORE absent from public HTML.
- Backend original V137 version 37c473f4-f2f7-4b77-a441-fc50baf48974.
- Backend bundle SHA256 ad99fb39cd59cfadea6573034d5a07a4c880dbbf74ae9b56aab0d0d68718726f.
- V137 quota marker present; SyncWatcher absent; /api/notify/ui-state returns the
  original 405 METHOD_NOT_ALLOWED runtime response.
- Workflow 37899374809, job 113718090758, SUCCESS.

After full original rollback, /api/notify/status still reports
LIVE_DISCOVERY_UPSTREAM_ERROR:EVIDENCE_PROVIDER_ERROR, live0, paused false,
scanEnabled true. Worker quota remaining 37329 of 50000 does not establish
provider account quota. LIVE scan recovery is not claimed.

Initial full rollback restored both services but verification erroneously compared
the bundled deployed worker to its unbundled source file. The verification was
corrected and the same target versions were independently verified successfully.

Production no longer runs notification UI sync or collapsed research cards.
The sync-fix folder remains an undeployed candidate; original root V137 and
sync-fix/rollback/index.html are the restored baseline. Do not deploy candidates
without resolving provider errors and verifying actual LIVE scans.
