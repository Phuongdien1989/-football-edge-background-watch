# Football Edge V1.23.3 — Team + Fixture History Database

## Mục tiêu
Chuyển Football Edge từ chỉ lưu evidence/entry/live sang nền dữ liệu lịch sử đội bóng và trận đấu lâu dài trên Cloudflare D1, không làm app nặng dần theo thời gian.

## Thay đổi chính
- Thêm `teams`: một hồ sơ nhẹ cho mỗi team ID đã thấy.
- Thêm `fixture_history`: một record chuẩn hóa cho mỗi fixture, cập nhật khi trạng thái/tỷ số/kết quả thay đổi.
- Thêm `team_fixture_history`: ánh xạ mỗi fixture thành lịch sử riêng của HOME và AWAY, gồm opponent, venue, score, result W/D/L và points khi trận đã kết thúc.
- App tự xếp `FIXTURE_CATALOG` khi render danh sách fixture, nhưng chỉ khi History Schema đã READY.
- Dedupe bằng fingerprint + IndexedDB sync_state: không ghi lại cùng fixture nếu status/score/kickoff/round không thay đổi.
- Không phát sinh Football API call mới. Chỉ lưu lại dữ liệu app đã tải sẵn.
- Worker V1.2.3 có stats + read endpoints cho Teams / Fixture History / Team History.
- Database Center hiển thị `REMOTE TEAMS` và `FIXTURE HISTORY`.

## Schema
Core schema giữ nguyên `V1.23.1` để không làm hỏng Entry/QSIG/Validation đang chạy.
V1.23.3 dùng metadata riêng:
- `schema_version = V1.23.1`
- `history_schema_version = V1.23.3`

Chạy `schema_v1233_history.sql` một lần trên D1 Console để kích hoạt History Database.

## Non-regression
Hash các hàm core sau giữ nguyên so với V1.23.2:
- watchEvaluate
- h1WatchEvaluate
- hcEvaluate
- qsigUpdateFT / H1 / HC
- feMasterRankRows
- epPolicyForEngine
- startLiveWatch / startH1Watch / startHandicapWatch

History persistence là lớp bổ sung. Nếu D1/history schema chưa sẵn sàng, core H1/FT/HC/TOP/Entry/Validation vẫn chạy như cũ.
