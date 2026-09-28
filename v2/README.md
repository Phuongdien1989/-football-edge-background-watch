# FOOTBALL V2 — FOUNDATION

Branch: `v2-foundation`

## Trang thai
- V1: FROZEN / BENCHMARK ONLY
- V2 schema: `v2/001_v2_master_schema.sql`
- Production/main: CHUA BI THAY DOI
- D1 production: CHUA APPLY MIGRATION

## Nguyen tac bat buoc

**DO CHINH XAC → DO KHOP THUC TE → GIAI THICH DUOC → DO TIN CAY**

- DATA-FIRST
- PRESENT-FIRST
- VALIDATION-FIRST
- EXPLAINABLE-FIRST
- APP-STORE-FIRST
- BILINGUAL-FIRST
- ADDITIVE / NON-REGRESSION

## Khac biet cot loi voi V1

V1 `live_snapshots` chu yeu duoc tao theo TOP/ranking va bien dong signal/market. Cach nay tot cho theo doi signal cu nhung khong du lam tap du lieu V2 vi de thieu negative/control samples.

V2 tach ro:

1. **Data collection** — luu periodic snapshots cho moi fixture LIVE du dieu kien.
2. **State engine** — tinh state tu history + current data.
3. **Timeline** — HOT / RISING / WATCH chi la lop hien thi, khong quyet dinh du lieu nao duoc luu.
4. **Validation** — moi state du dieu kien co outcome window 5m/10m/15m/HT/FT.

## Bang cot loi

### Master data
- `v2_leagues`
- `v2_seasons`
- `v2_teams`
- `v2_fixtures`

### Ingestion / health
- `v2_ingest_runs`
- `v2_source_health`

### LIVE history
- `v2_live_snapshots`
- `v2_live_team_stats`
- `v2_fixture_events`
- `v2_lineup_snapshots`
- `v2_data_quality_snapshots`

### Intelligence / validation
- `v2_model_versions`
- `v2_team_profile_snapshots`
- `v2_match_baselines`
- `v2_state_snapshots`
- `v2_state_outcomes`
- `v2_validation_runs`

### UI cache
- `v2_current_fixture_state`

`v2_current_fixture_state` chi la cache. Source of truth la immutable history.

## DQ Gate

Moi LIVE snapshot phai co:
- COVERAGE
- INTEGRITY
- FRESHNESS
- DQ SCORE
- GATE STATUS

Rule:

`HIGH SIGNAL + LOW DQ = KHONG PROMOTE HOT`

Khi thieu du lieu: `INSUFFICIENT DATA / CHUA DU DU LIEU`.

## Model versioning

Moi cong thuc/threshold/state engine phai co `model_version`.
Khong sua nguoc history model cu. Version moi chay SHADOW truoc khi ACTIVE.

## Gate tiep theo

### GATE 3A — Schema local
PASS: schema/constraint/index da kiem thu local.

### GATE 3B — D1 migration
NEXT:
1. doi chieu Worker production dang chay;
2. apply `001_v2_master_schema.sql` len D1;
3. kiem tra v2_schema_meta;
4. dem bang/index;
5. khong sua `fe_schema_meta` V1;
6. health V1 van PASS.

### GATE 4 — Ingestion + Data Quality
Chi bat dau sau khi Gate 3B PASS.

## Canh bao hien tai

`worker.js` tren `main` hien khai bao Worker 1.2.1, trong khi front-end baseline da tham chieu Worker 1.2.2. Khong duoc deploy lai Worker tu `main` cho den khi doi chieu duoc production source de tranh regression.
