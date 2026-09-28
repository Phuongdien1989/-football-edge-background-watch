# FOOTBALL V2 — GATE 7 REMOTE D1 + SHADOW DEPLOY

## MUC TIEU
Dua V2 vao D1 remote va deploy Shadow wrapper ma khong thay logic V1.

## 1. BACKUP
```bash
mkdir -p backups
npx wrangler d1 export football-edge-db --remote --output=./backups/football-edge-db-before-v2.sql
```
Khong di tiep neu backup fail.

## 2. PRECHECK V1
```bash
npx wrangler d1 execute football-edge-db --remote --file=./v2/GATE7_PRECHECK.sql
```
Expected: V1 core `V1.23.1`, V1 history `V1.23.3`. Ghi lai counts.

## 3. APPLY 001
```bash
npx wrangler d1 execute football-edge-db --remote --file=./v2/001_v2_master_schema.sql
npx wrangler d1 execute football-edge-db --remote --file=./v2/GATE7_CHECK_AFTER_001.sql
```
Expected V2 schema `2.0.0-foundation`.

## 4. APPLY 002 BACKFILL
```bash
npx wrangler d1 execute football-edge-db --remote --file=./v2/002_v2_seed_from_v1_history.sql
```

## 5. CHECK 003
```bash
npx wrangler d1 execute football-edge-db --remote --file=./v2/GATE7_CHECK_BEFORE_003.sql
```
Neu `capability_json` CHUA ton tai:
```bash
npx wrangler d1 execute football-edge-db --remote --file=./v2/003_v2_ingestion_quality.sql
```
Neu da co `capability_json`: BO QUA 003.

## 6. POSTCHECK
```bash
npx wrangler d1 execute football-edge-db --remote --file=./v2/GATE7_POSTCHECK.sql
```
PASS khi V1 schema khong doi, V2 schema/dq policy dung, duplicate=0, FK check sach.

## 7. DEPLOY SHADOW OFF
```bash
npx wrangler deploy --config wrangler.v2-shadow.toml
```
Config mac dinh `V2_SHADOW_ENABLED=0`. Kiem app V1, notify, PAUSE/RESUME truoc.

## 8. STATUS
GET `/api/v2/shadow/status` voi Bearer BACKGROUND_TOKEN. Expected `enabled=false`, `schema.ok=true`.

## 9. BAT SHADOW
Doi duy nhat:
```toml
V2_SHADOW_ENABLED = "1"
```
Deploy lai.

## 10. RUN ONCE
POST `/api/v2/shadow/run-once` voi Bearer token. Sau do:
```bash
npx wrangler d1 execute football-edge-db --remote --file=./v2/GATE7_SHADOW_AUDIT.sql
```

## 11. QUAN SAT 24H+
Khong tang budget. Gate PASS khi duplicate=0, orphan=0, FK sach, DQ hop ly, capture chain lien tuc, V1 khong regression.

## ROLLBACK
Worker rollback nhanh:
```bash
npx wrangler deploy --config wrangler.toml
```
Khong DROP v2_* trong rollback thong thuong.
