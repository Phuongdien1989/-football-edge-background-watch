# LIVE / automatic PUSH trace — 2026-10-13 09:07 UTC

## Verified evidence
- Audit source: accc30afedeafeb83791149866efa9a2afa46e51
- Audit Actions: https://github.com/Phuongdien1989/-football-edge-background-watch/actions/runs/38374051607 — PASS (observation completed, not app acceptance).
- Source regression: https://github.com/Phuongdien1989/-football-edge-background-watch/actions/runs/38374050209 — PASS.
- Production remained 5f33a4b1-a299-4195-8a68-4646396a9214 at 100%, deployed source 6b7accb869cf64598b7ca39d5326d6b4080313e1. No production deployment in this trace.
- Temporary authenticated audit Worker deleted successfully. No extra provider calls, test PUSH, scan-toggle or database changes.
- User manually enabled scanning. Do not silently change their ON/OFF choice.
- Latest device preferences: H1 72, FT 60, HC/GAP 60. Other older device FT/HC 70.
- Test PUSH accepted at 08:58 UTC with 514 ms transport; user's screenshot confirms phone reception. Automatic signal delivery unverified.

## Data path observations
- 09:05 UTC health observed LIVE 3 / scanned 3, no cycle errors. This establishes intermittent discovery, not sustained recovery.
- 09:07 UTC audit observed LIVE discovery cooldown; the preceding endpoint failures reached scoped LIVE cooldown (60 seconds).
- D1 fixture states 1629933, 1640229, 1640228, 1645465: STATS_UNAVAILABLE with stats ERROR and half ERROR. Latest states have no current scores; notification tick skips signal evaluation on missing full statistics.
- Fixture 1629933 had 6 valid saved history points and an earlier FULL evaluation (raw FT engine score 51). Its latest statistics failed after prior successful samples. Raw FT engine score is NOT the device calibrated goal probability; do not compare it directly with notification threshold.
- Alert states retained armed, last accepted 0. No evidence of duplicate guard suppressing an already qualified alert.
- A successful separate fixture response advertises daily 75000, remaining 74209; minute 450, remaining 445. Failing observations HTTP 200, missing quota headers and rate-limit classification. These different timestamps/endpoints do not prove identical request or source IP.
- Public provider diagnostics omit sanitized error-body detail; API source classifier matches error-body rate text. The audit cannot confirm provider protection cause (key / outbound IP / endpoint) from classification alone.

## Reporting issue identified
Frontend scan badge uses cycle age and only scan.errors. notifyTick records per-source failures in scan.warnings / degraded and item.last.sourceHealth. Consequently a fresh cycle can appear scanning while every fixture lacks Statistics. Engines/frontend have not been altered; this is an observability gap, not proof of healthy analysis.

## Next evidence required
Compare one same current fixture's full Statistics through foreground app (phone's direct API path) and Worker within a short interval, confirming identical API credential through secure configuration, without pasting a key into chat. If user can show Statistics in manual foreground but Worker has ERROR for that same fixture, the next trace narrows to Worker request / network / account source policy. If both fail, investigate endpoint/account response. Do not recommend paid infrastructure or weaken thresholds based solely on current evidence.
