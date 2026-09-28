# FOOTBALL V2 — SHADOW LIVE CAPTURE v0.6.1

## MUC TIEU
Thu thap LIVE that + DQ + history V2. **KHONG NHAN DINH.**

## SAFETY
- `worker_v2_shadow_capture.js` ke thua Worker V1 hien tai.
- V1 van la scheduling owner.
- Shadow mac dinh OFF.
- Chi chay khi `V2_SHADOW_ENABLED=1`.
- Ton trong `PAUSE / ALL_BACKGROUND_API`.
- Sau `super.alarm()` Worker doc lai PAUSE truoc khi shadow capture.
- Khong tao Push.
- Khong sua H1/FT/HC/threshold/ranking.
- `wrangler.toml` production chua duoc doi sang file nay.

## CAN CO TRUOC KHI BAT
D1 phai co:
1. `001_v2_master_schema.sql`
2. `002_v2_seed_from_v1_history.sql`
3. `003_v2_ingestion_quality.sql`

## ENV / VARS
- `V2_SHADOW_ENABLED=1`
- `V2_SHADOW_MAX_FIXTURES=12`
- `V2_SHADOW_TICK_INTERVAL_MS=120000`
- `V2_SHADOW_DAILY_BUDGET=4000` (default an toan cho shadow ban dau)

Secrets V1 giu nguyen:
- APISPORTS_KEY
- BACKGROUND_TOKEN

## ENDPOINTS
### GET `/api/v2/shadow/status`
Authorization: Bearer BACKGROUND_TOKEN

### POST `/api/v2/shadow/run-once`
Authorization required.
Chi chay khi shadow enabled va Background khong PAUSE.

## CAPTURE LOGIC
- Shadow discovery tick: 120s
- Base periodic: 120s
- OPEN_CARD/FOLLOW hook: 60s
- Goal / period transition: uu tien event, min gap 15s
- Global DB bucket: 15s
- Max 12 fixture/tick
- API fan-out concurrency: 3 fixtures

## QUOTA GATE
Khong tang budget V2 cho toi khi doi chieu quota thuc te + V1 usage. V2 shadow co budget rieng de khong am tham an het quota cua app cu.

## OBSERVATION GATE
Chua mo State Engine cho toi khi co it nhat:
- >= 24h shadow runtime
- duplicate snapshot = 0
- orphan/FK error = 0
- capture gap duoc audit
- DQ distribution hop ly
- V1 scan/notification khong regression
