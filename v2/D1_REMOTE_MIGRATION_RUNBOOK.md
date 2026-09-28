# FOOTBALL V2 — D1 REMOTE MIGRATION RUNBOOK

Muc tieu: apply V2 tables/backfill vao D1 hien tai **ma khong sua bang V1**.

Database binding hien tai: `FOOTBALL_DB`
Database name: `football-edge-db`

## PRE-CHECK

Tu repo root:

```bash
npx wrangler d1 execute football-edge-db --remote --command="SELECT key,value FROM fe_schema_meta WHERE key IN ('schema_version','history_schema_version') ORDER BY key;"
```

Ky vong:
- `schema_version = V1.23.1`
- `history_schema_version = V1.23.3`

Ghi lai so dong V1:

```bash
npx wrangler d1 execute football-edge-db --remote --command="SELECT (SELECT COUNT(*) FROM teams) AS teams,(SELECT COUNT(*) FROM fixture_history) AS fixtures,(SELECT COUNT(*) FROM live_snapshots) AS live_snapshots,(SELECT COUNT(*) FROM qsig_results) AS qsig,(SELECT COUNT(*) FROM validation_results) AS validation;"
```

## APPLY 001 — MASTER SCHEMA

```bash
npx wrangler d1 execute football-edge-db --remote --file=./v2/001_v2_master_schema.sql
```

Kiem tra:

```bash
npx wrangler d1 execute football-edge-db --remote --command="SELECT * FROM v2_schema_meta;"
```

Phai co:
- `schema_version = 2.0.0-foundation`
- `spec_version = 0.2`

## APPLY 002 — BACKFILL V1 HISTORY

```bash
npx wrangler d1 execute football-edge-db --remote --file=./v2/002_v2_seed_from_v1_history.sql
```

## POST-CHECK V2

```bash
npx wrangler d1 execute football-edge-db --remote --command="SELECT (SELECT COUNT(*) FROM v2_leagues) AS leagues,(SELECT COUNT(*) FROM v2_seasons) AS seasons,(SELECT COUNT(*) FROM v2_teams) AS teams,(SELECT COUNT(*) FROM v2_fixtures) AS fixtures;"
```

Kiem tra fixture bi skip vi thieu relational key:

```bash
npx wrangler d1 execute football-edge-db --remote --command="SELECT COUNT(*) AS skipped_missing_keys FROM fixture_history WHERE league_id IS NULL OR season IS NULL OR home_team_id IS NULL OR away_team_id IS NULL OR kickoff IS NULL OR home_team_id=away_team_id;"
```

## NON-REGRESSION CHECK

Chay lai:

```bash
npx wrangler d1 execute football-edge-db --remote --command="SELECT key,value FROM fe_schema_meta WHERE key IN ('schema_version','history_schema_version') ORDER BY key;"
```

V1 phai van:
- `V1.23.1`
- `V1.23.3`

So dong cac bang V1 phai khong giam sau migration.

## IDEMPOTENCY CHECK

Migration 001/002 duoc thiet ke de chay lai an toan.
Neu can test, chay lai 002 va xac nhan count V2 khong tu tang bat thuong.

## CHUA DEPLOY WORKER V2

Sau khi database PASS, **chua doi `wrangler.toml` ngay**.
Buoc tiep theo la test `worker_v2_foundation.js` va route read-only:
- `/api/v2/health`
- `/api/v2/db/health`

Chi sau khi health + V1 routes deu PASS moi bat dau V2 ingestion.

## STOP CONDITIONS

Dung ngay neu:
- `fe_schema_meta` V1 thay doi bat thuong;
- migration 001 fail foreign key/schema;
- count V1 giam;
- backfill V2 co fixture/team mapping sai;
- timezone/kickoff bi lech;
- D1 health V1 bi anh huong.
