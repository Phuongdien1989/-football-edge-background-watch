# FOOTBALL V2 — LIVE CAPTURE POLICY

## MUC TIEU
Tao chuoi thoi gian LIVE du de do state, state velocity, replay va validation.

## NGUYEN TAC BAT BUOC
**KHONG CHI LUU KHI CO SIGNAL.**

Timeline HOT/RISING/WATCH khong duoc quyet dinh fixture nao co lich su.

## BASE CAPTURE
Tat ca fixture LIVE du dieu kien:
- snapshot periodic muc tieu: 120 giay;
- van luu snapshot khi state khong doi;
- muc dich: duration + negative/control samples.

## ACTIVE CAPTURE
Co the giam xuong 60 giay khi:
- DQ du tot;
- stats dang thay doi nhanh;
- co event moi;
- user dang mo Live Card;
- model dang can quan sat sat hon.

## EVENT SNAPSHOT
Tao snapshot bo sung khi scan phat hien:
- GOAL
- RED CARD
- HT
- 2H START
- FT
- score correction

Khong xoa state truoc event. Event tao game-state context moi.

## DEDUPE
Moi snapshot co:
- `capture_bucket`
- `capture_interval_sec`
- `capture_reason`

Unique `(fixture_id, capture_bucket)` chong retry trung lap.

## DATA QUALITY
Moi accepted snapshot phai tinh:
- COVERAGE
- INTEGRITY
- FRESHNESS
- DQ SCORE
- GATE STATUS

Rule:

`HIGH SIGNAL + LOW DQ = KHONG PROMOTE HOT`

Neu data khong du:
`INSUFFICIENT DATA / CHUA DU DU LIEU`.

## STATE COMPUTE
Moi snapshot hop le:
1. normalize;
2. DQ;
3. foundation state;
4. WHY?/feature payload;
5. state outcome placeholder;
6. resolve 5m/10m/15m/HT/FT ve sau.

## CONTROL SAMPLE
State khong duoc promote van phai duoc luu neu snapshot hop le.
Day la dieu kien de validation khong bi selection bias.

## QUOTA
Capture cadence la Worker config, khong hardcode vao score engine.
Sau nay dieu chinh cadence dua tren API freshness + quota + storage, khong dua tren cam tinh.
