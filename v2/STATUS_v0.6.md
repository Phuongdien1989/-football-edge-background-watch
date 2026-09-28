# FOOTBALL V2 — STATUS v0.6.1

## B6 SHADOW LIVE CAPTURE WORKER
**LOCAL PASS / BRANCH-READY**

### DA CO
- Shadow enable switch
- D1 schema readiness gate
- Same V1 PAUSE semantics, re-check sau `super.alarm()`
- Own daily API budget (default 4,000/day)
- Independent 120s shadow tick throttle
- League-season coverage cache
- All-LIVE discovery
- Least-recently-captured round robin
- 120s BASE capture
- 60s ACTIVE hook
- Goal/period priority capture
- bounded concurrency
- normalize + DQ + D1 persistence
- ingest run audit
- status endpoint
- manual run endpoint
- no Push / no state engine

### KHONG LAM
- Khong doi production `wrangler.toml`
- Khong bat `V2_SHADOW_ENABLED`
- Khong apply D1 remote migration
- Khong tao GOAL THREAT / PRESSURE / TIMELINE
