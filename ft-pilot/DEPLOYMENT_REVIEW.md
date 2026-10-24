# CẬP NHẬT NGHIỆM THU PHASE 2 (23/10/2026)

- Đã có kiểm thử Workerd/Miniflare D1+Durable Object thực ở máy CI: **36 kiểm tra PASS**, bao gồm restart, giới hạn 5 trận, khóa sửa/xóa và tự dừng FT khi thiếu schema.
- Xem [báo cáo Phase 2](PHASE2_WORKERD_SHADOW_REVIEW.md) và workflow `ft-pilot-shadow-runtime.yml`.
- Kết quả trước/sau với chính hàm `notifyTick`, bộ chấm điểm H1/FT/HC và adapter Mobile vẫn 21/21 PASS. Kiểm thử này chỉ xác minh trạng thái từ cùng input trong Node, không phải benchmark production.
- **Chưa có xác nhận tương đương bản production:** Miniflare v4 sử dụng compatibility date 2026-08-01 (bản production 2026-09-11); backend DO dưới tải thật, billed D1, CPU/p95, TOP thực và tỷ lệ Outcome thực đều CHƯA ĐO.
- PR vẫn Draft; không sửa schema production, không deploy, không bật scanner.

---

# FOOTBALL EDGE — FT DATA CAPTURE PILOT | GÓI TRÌNH DUYỆT
Checkpoint 23/10/2026. PR #16 `fix/ft-foundation-20261021` DRAFT. **CHƯA ĐƯỢC PHÉP DEPLOY, CHƯA MIGRATE PRODUCTION, CHƯA BẬT SCANNER/RECORDER.**

## 1. Hiện trạng đã làm
Các mô-đun ứng viên nằm **riêng** trong `ft-pilot/`:
- `schema-candidate.sql`: 3 bảng riêng (`ft_pilot_control_v1`, `ft_pilot_pairs_v1`, `ft_pilot_outcomes_v1`) + 4 trigger chống UPDATE/DELETE. Không sửa schema HT, HC, bảng cũ hoặc dữ liệu đã lưu. Tất cả điều kiện giới hạn xét **trong INSERT SQL** để chặn đồng thời và qua restart.
- `recorder.mjs`: nguồn fixture/stats/events/odds/half lấy từ **các response scanner hiện hành đã có**, kèm received_at từng nguồn, tỷ số, phút, mã logic SHA256, outcome tách riêng. Mảng rỗng giữ EMPTY; ERROR/INVALID giữ null + lý do. Không gán giá thị trường nếu API thiếu.
- `integration.mjs`: OFF mặc định theo `FT_PILOT_ENABLED`; khi ON chỉ dùng `ctx.waitUntil` để không await vào lộ trình xử lý HT/HC/Push. DO storage kiểm tra pause, dedup skip/accepted và **đặt trước** ngân sách SQL/billed-write token. Lỗi ghi/pause chỉ vô hiệu FT; không gọi API, không sửa scheduler, không đổi countdown hoặc trạng thái HT/HC.
- `build-review-patch.mjs`: tạo **bản sao** `worker_notify_v130.js` và `worker.js` có thêm hook từ response sẵn có. 2 file gốc vẫn y nguyên, không thay `wrangler.toml` hoặc main v138. Bản sao dùng để soát diff và kiểm thử cú pháp, **KHÔNG phải release artifact có thể deploy ngay**.
- `test.mjs`: SQLite thực với từng câu SQL mở kết nối mới (restart simulation), assert giới hạn 5 trận, lớp cân bằng 3+2, một cặp bất biến/trận, lưu outcome chỉnh sửa dạng append only, pending, hủy trận, pause lỗi D1.
- `test-integration.mjs`: test flag OFF, `waitUntil` độc lập Push, so sánh mảng HT/HC score/history/cooldown/valuation/card/TOP/Push mẫu trước–sau, kiểm nguồn API và hook Outcome. Đây **không chứng minh an toàn production**, không mô phỏng đầy đủ lưu lượng và tài nguyên dùng chung.
- `wrangler-additions.review.toml`: bản ghi cấu hình bổ sung **mang tính hướng dẫn**; không sử dụng trực tiếp để deploy.

## 2. Giới hạn cứng của một pilot (đã mã hóa)
| Thuộc tính | Mức |
|---|---|
| Mặc định | `FT_PILOT_ENABLED=false`; ngoài ra phải có bảng control epoch `enabled=1` khi được duyệt |
| Trận khác nhau tối đa | **5** trong mỗi epoch, khóa `PRIMARY KEY(epoch,fixture_id)` |
| Chọn mẫu | Tối đa 3 trận `RECOMMENDATION_CANDIDATE`, tối đa 3 `NOT_RECOMMENDED`; ở mẫu đủ 5 là 3+2 hoặc 2+3 |
| Định nghĩa candidate | Có tín hiệu FT được Push sender hiện hành **chấp nhận gửi**; không cam kết thiết bị đã nhận hoặc người dùng đã vào kèo |
| Cặp/fixture | 1 Observation+Decision không thay đổi; tối đa **5 bản ghi pair** |
| Kết quả/fixture | Tối đa 2 phiên bản cùng fixture; tổng tối đa **10 bản ghi Outcome**, chỉnh sửa chỉ append |
| Dữ liệu tổng cộng | Pair tối đa 20.000 bytes/cặp và 100.000 bytes/epoch; Outcome tối đa 4.096 bytes/bản ghi; tối đa xấp xỉ 141 KB payload, chưa tính row/index overhead |
| Giai đoạn capture | Đề xuất **4 giờ** với capture_start/end xác định bởi người duyệt |
| Nhận Outcome | Đề xuất đến **72 giờ** sau khi bắt đầu capture; chỉ từ API response sẵn có |
| Lượt SQL FT | Tối đa **3** SQL/event và **60** SQL được đặt trước trong Durable Object cả epoch |
| Billed D1 write tokens | Tối đa **240** token dự phòng cho cả epoch; đặt trước 16/event, không hoàn lại khi gặp lỗi/restart |
| Khuếch đại billed rowsWritten/event | Nếu giá trị D1 `meta.rows_written` của 1 INSERT vượt 16 hoặc không có giá trị tin cậy thì pause FT |
| Hết ngân sách | Dừng FT sidecar riêng, không disable scanner và không tác động HT/HC |
| Provider calls mới | **0**; không poll/retry/timer/alarm riêng |
| Khuyến nghị FT V2, AI fair odds, EV | **OFF** |

**Lưu ý về chi phí:** 5 pair + tối đa 10 Outcome = tối đa 15 hàng dữ liệu logic được thêm, không tính control, migration, SQLite PK/index, trigger, read và DO storage. Số `rowsWritten` D1 **có tính cả index và mọi overhead**; 240 token là **giới hạn đặt trước**, không phải dự đoán/hạn mức tính cước do Cloudflare đảm bảo. Kiểm tra billing phải đọc `meta.rows_written`, `meta.rows_read` và analytics account-wide trước–sau. Do một lần INSERT có thể vượt 16 trước khi phát hiện, không thể coi 240 token là hard billing ceiling tuyệt đối. Chỉ nghiệm thu được sau pilot thật.

## 3. Dữ liệu được chọn, bỏ qua và lý do
`FE_FT_PILOT_AUDIT` ghi số fixture ID, lớp mẫu, trạng thái và số SQL (không log odds JSON hay thông tin bí mật). Những nhãn tiêu biểu:
- `PAIR_STORED`, `SKIPPED_EXISTING_FIXTURE`, `SKIPPED_FIVE_FIXTURE_CAP`, `SKIPPED_BALANCED_CLASS_CAP`
- `SKIPPED_TOTAL_BYTE_CAP`, `SKIPPED_CAPTURE_WINDOW_CLOSED`, `PAIR_INVALID_OR_TOO_LARGE`
- `OUTCOME_STORED`, `OUTCOME_ALREADY_RECORDED`, `OUTCOME_CORRECTION_APPENDED`, `PENDING`, `UNSETTLED`, `OUTCOME_NO_SELECTED_PAIR`
- `FT_PILOT_SQL_CAP`, `D1_ERROR_PAUSED`, `BILLING_UNVERIFIED_PAUSED`
Bằng chứng chọn/bỏ của một pilot chỉ được coi là đầy đủ khi có **log và ledger đợt chạy thật**; chạy offline chưa tạo danh sách fixture thật.

## 4. Điều kiện để triển khai sau phê duyệt — CHƯA LÀM
1. Kiểm tra lại HEAD, production version hiện hành, D1 account Free actual quota, scanner OFF, rollback backend/Mobile và chốt bất biến HT/HC.
2. Review các diff của hai file trong `ft-audit-output/ft-pilot-candidate/`, kiểm định nguồn đóng gói gốc. Gắn cờ vào đúng backend v138 kế thừa v130, **không phát hành Mobile hoặc HT assets**, giữ bản backup trước.
3. Triển khai riêng `schema-candidate.sql` và thêm alias `FT_PILOT_DB` trỏ **cùng D1 football-edge-db**, rồi provision `ft_pilot_control_v1` với `enabled=0` và thời gian/cap cố định. Đây là thay đổi production, **cần cho phép riêng**, chưa thực hiện.
4. Deploy ứng viên với `FT_PILOT_ENABLED=false`, nghiệm thu backend/HT/HC/Push/TOP/Mobile và đo độ trễ/billed rowsRead/Written; người duyệt quyết định bước bật cờ, giờ chạy, 5-fixture pool và ngân sách chính thức.
5. Chỉ sau khi được cho phép thêm: bật epoch control + cờ; thao tác quét vẫn thuộc vận hành scanner hiện hữu, **không tự bật scanner**. Dừng sau tối đa 5 trận, sau timeout hoặc khi tài nguyên vượt mức.
6. Thu nhận Outcome PASSIVE khi luồng chứng cứ đã fetch đúng fixture và trả về FT/AET/PEN với `score.fulltime`; không thêm poll `/fixtures`.

## 5. Feasibility Outcome: KHÔNG ĐẢM BẢO ĐỦ 5/5
- Source `worker.js` `pollEvidence()` có gọi `this.api('/fixtures',{id:j.fixture_id},true)` **sẵn có**, phù hợp tiếp nhận tỷ số chính thức cho những fixture **đã có evidence jobs**.
- Scanner Notification hiện tại lọc trận đang LIVE (1H/2H), vì thế không cung cấp FT terminal một cách mặc định cho mọi trận pilot.
- Không có cam kết tất cả 5 fixture pilot sẽ vào evidenceJobs. Nếu không có callback, **Outcome vẫn PENDING**, không biến thành MISS và không gọi API riêng; đây là blocker cần xác minh bằng pilot đo coverage hoặc xin phương án thu FT sau đó.
- Với AET/PEN chỉ lấy `score.fulltime`, không dùng tỷ số sau hiệp phụ hoặc penalty; CANC/ABD/AWD/WO không settle.
- Khi kết quả sửa và callback xuất hiện, append bản mới tối đa 2 phiên bản, giữ bản cũ; không tự chọn kết quả mâu thuẫn làm nhãn thắng thua.

## 6. Đường rollback và xóa cờ (giữ dữ liệu)
- Tắt cờ `FT_PILOT_ENABLED=false` và đặt `ft_pilot_control_v1.enabled=0` cho epoch đang chạy; **không DROP, DELETE hoặc UPDATE dữ liệu PAIR/Outcome**.
- Nếu có tác động nguồn chung: rollback **Worker code** về phiên bản đã xác minh trước pilot; Mobile và HT/HC giữ nguyên các version riêng.
- Không reset DO storage của HT/HC, không xoá scanner alarm, không reset Push, TOP hoặc cooldown.
- Các bản ghi pilot và mã băm giữ nguyên để audit về sau, còn khóa DO pause không cần xóa. Re-enable phải có epoch mới và duyệt mới; không tự tái khởi động từ lỗi.

## 7. Checklist nghiệm thu chưa hoàn tất
- D1 production schema **chưa provision**; chưa thử Workers D1 transaction behavior/account billed row/index overhead.
- Chưa có 5 trận thật hay bất kỳ dữ liệu kết quả pilot thật.
- Chưa đo chênh lệch độ trễ và CPU/DO/D1 trên backend production dưới tải; test offline `waitUntil` chỉ chứng minh cách đặt hook.
- Chưa có before/after HT/HC trên chính production với feature flag ON. Card HT/HC/định giá/TOP/Push/Mobile vẫn **không bị sửa** trong PR, nhưng cần nghiệm thu sau khi triển khai được duyệt.
- Outcome coverage không bảo đảm với luồng hiện tại. Đây là pilot dữ liệu, **không phải pilot lợi nhuận hay mô hình xác suất đã hiệu chỉnh**.

## 8. Links & checkpoint
CI và HEAD cập nhật trong bản ghi hoàn tất phiên bản mới nhất của PR #16. Toàn bộ artifact review lấy trong GitHub Actions 'FT Pilot review package — no deployment'. Không có rollout cloud được thực hiện.
