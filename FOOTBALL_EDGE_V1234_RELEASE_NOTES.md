# Football Edge V1.23.4 — Database Analytics

## Mục tiêu
Biến D1 từ kho lưu trữ thành lớp phân tích đọc-only, nhưng không để analytics can thiệp vào H1/FT/HC, TOP Ranking, Entry Policy hay threshold production.

## Thay đổi
- Database Center nâng lên V1.23.4.
- Thêm `DATABASE ANALYTICS` đọc trực tiếp từ D1.
- Worker V1.2.4 thêm route `GET /api/db/analytics/overview`.
- Analytics hiện tổng hợp:
  - số lượng Entry / QSIG / Validation / Teams / Fixtures / Live snapshots;
  - Entry theo Policy;
  - Entry theo Price Zone;
  - QSIG theo engine, HIT/MISS và hit-rate khi outcome có thể quy về HIT/MISS;
  - Validation theo type/result;
  - Team History theo số trận và W-D-L.
- Không thêm table mới, không cần migration SQL mới.
- Analytics chỉ đọc (`READ_ONLY`), không ghi D1 và không đổi rule.

## Guard / Non-regression
- Stable core vẫn `APP_VERSION = 1.16.2`.
- `watchEvaluate`, `h1WatchEvaluate`, `hcEvaluate`, `startLiveWatch`, `startH1Watch`, `startHandicapWatch` giữ nguyên hash so với V1.23.3.
- Nếu D1/analytics lỗi, app và toàn bộ engine vẫn chạy theo cơ chế hiện tại.

## Worker
- Worker release: `1.2.4`
- Core schema: `V1.23.1`
- History schema: `V1.23.3`
- Không cần chạy schema mới cho V1.23.4.
