# FOOTBALL EDGE — CHECKPOINT BƯỚC 5

Ngày 20/10/2026. Phạm vi: nghiệm thu UI tab và chuẩn bị ứng viên sạch. Không phát hành giao diện tab lên Mobile chính.

## Mã nguồn và phạm vi

Repository: Phuongdien1989/-football-edge-background-watch.
Nhánh: feature/ft-overview-shadow-20261019; PR #12 tiếp tục DRAFT.
Source kiểm thử: b660b1dd7e78236a33b2b709af6bcad20ef88971.
Workflow: https://github.com/Phuongdien1989/-football-edge-background-watch/actions/runs/39400639611
Kết quả cuối: PASS, gồm kiểm tra trước xuất bản, bản sạch và HTTPS sau xuất bản.
Preview version: a6df4d3e-f39b-4a02-b501-0f7218f1a16e, 0 binding.
Artifact: 12255087895, tên football-edge-tabs-step3-preview (tên cũ dùng chung).
Bản ghép thử: https://football-edge-tabs-preview.ngophuonghuy.workers.dev/integrated.html#fe-tabs/overview
Trước/sau workflow, ba version Mobile/backend/Desktop bên dưới khớp tuyệt đối.

Không sửa backend, D1, Push, thuật toán/threshold, nhịp quét, Smart Follow hoặc Desktop. Không tự bật scanner. Không merge PR #6/#7. Bộ đóng băng bước 1 còn nguyên.

## Đã sửa

1. Giới hạn việc chọn signal theo đúng tab. Link HT tới fixture chỉ có FT không được lấy FT thay thế. Overview vẫn chọn primary theo Master hiện hữu.
2. Khi ra trang Trận đấu/Cài đặt, đồng bộ hash trước khi giao điều khiển cho handler cũ. Mở lại #scanCard giữ trang Trận đấu, không quay nhầm tab trước đó.
3. Đồng bộ chỉ báo active của thanh điều hướng dưới: Overview/Trang chủ, các cơ chế/Phân tích.
4. Không thêm timer, API request, store hay thuật toán xếp hạng. Các card/nút/bridge gốc giữ nguyên node và identity.

## Hai bản hoàn toàn khác nhau

- `generated/integrated.html`: SANDBOX công khai, vẫn khóa API/quét/Push và có QA seed có điều kiện. Không bao giờ deploy file này lên app chính.
- `generated/candidate/index.html`: HTML ứng viên sạch. Chỉ thêm panel, link CSS và module vào đúng HTML Mobile baseline. Gỡ ba phần thêm phải tái tạo chính xác baseline.
- `generated/candidate/ui-tabs/integrated.mjs`: module sạch đã loại đoạn SANDBOX_ONLY; không có fetch override, QA hook hoặc khóa input/nút quét.
- `generated/candidate/ft-overview/`: module FT Overview dùng chung, gồm readDisplay đã kiểm thử từ bước 4A; không tạo store/model thứ hai.
- `generated/candidate/candidate-build.json`: hash và chứng cứ cấu trúc sạch.

Ứng viên này là bộ tệp cập nhật frontend, KHÔNG phải bộ sao lưu toàn tài khoản hoặc D1; còn cần giữ các static asset/manifest/icons/push-sw/original hiện có khi đóng gói phát hành. Không đưa CSP connect-src none của máy chủ QA/sandbox vào cấu hình app chính.

Baseline HTML SHA256: 9c557b2b20744aaad5b14ddd367517bd4afb00a7af182ead93e346f857f9947e.
Candidate HTML SHA256: 88a4a49e62fe6c6ce37445d00457d728de1c1ee55a4bc8e8b1359994ea9f3bdc.

## Kiểm thử

- 20 read-model + 36 FT Overview core regression PASS.
- Same-page Chromium 390/1280: bridge/engine runtime thật của mã gốc; fixture QA chỉ trong bộ nhớ browser riêng.
- TOP hiển thị khớp TOP từ nguồn; không tự tính lại rank.
- Hai vòng đổi tab không thay items/active, không thêm interval, không thay node/bridge/store gốc.
- Deep link sai engine bị chặn; empty source không dựng fixture cũ/mẫu.
- Stale, ended và cooldown không vào TOP hiện hữu.
- Điều hướng cũ, mở công cụ đúng engine, quay danh sách, hash và tải lại trang Trận đấu.
- Bản sạch được thử riêng, không có sandbox global/banner/QA hook; input cấu hình gốc không bị khóa.
- Chromium có viewport/touch iPhone 13 và desktop: không tràn ngang. Đây KHÔNG phải nghiệm thu Safari/iPhone/PWA thật.
- Nguồn lỗi và stale recommendation được kiểm thử ở read-model/core; không tuyên bố đã tái hiện tất cả lỗi provider trên production.

QA server/browser harness chủ động chặn mạng. Không nhập API key, không dùng token production, không tạo Push thật hoặc ghi D1. Bản sạch không tự mang cơ chế khóa mạng đó.

## Bảo vệ và rollback

Mobile chính/rollback cho lần UI tiếp theo: b73642ec-1d4c-41ae-bc28-68c785b6fd79.
Backend giữ: 04cc044d-412f-4844-9b83-c7c786eedd13.
Desktop giữ: a332ee39-abb2-422d-a021-db78ef19cc10.
Không tự quay về rollback Mobile xa hơn ac8/03c1.
Không chạy `ft-overview/live-release.mjs` cũ: guard/rollback không còn đúng baseline phát hành tiếp theo.

## Phần còn lại trước khi đưa vào app chính

1. Người dùng nghiệm thu bố cục/tab trên điện thoại; preview sandbox không có LIVE và không tự đọc dữ liệu/credential của app chính khác origin.
2. Kiểm tra Safari/PWA thật, quyền thông báo, link mở từ notification và hành vi phiên đã lưu. Không xóa dữ liệu điện thoại để thử.
3. Chuẩn bị release script riêng có guard đúng Mobile b736, backend 04cc, Desktop a332 và hash baseline; giữ toàn bộ asset/manifest/push-sw/original; backup xác minh được trước phát hành.
4. Chỉ khi người dùng duyệt phát hành: deploy đúng ứng viên sạch đã kiểm thử, kiểm tra active version 100%, hash/tệp và rollback.
5. LIVE/PUSH thật cần kiểm chứng trên phiên có dữ liệu thực; chỉ bật quét khi người dùng chủ động yêu cầu. Chưa có chứng cứ end-to-end điện thoại từ bước UI này.

## Chuyển khung chat

Tiếp tục Football Edge từ checkpoint mới nhất nhánh feature/ft-overview-shadow-20261019, đọc audits/2026-10-20/UI_TABS_STEP5_VI.md. Mã kiểm thử bước 5 b660b1dd7e78236a33b2b709af6bcad20ef88971. Không làm lại bước 1–4. Giao diện tab vẫn ở preview; app chính chưa deploy. Không dùng generated/integrated.html để phát hành, chỉ dùng candidate sạch sau nghiệm thu và có release guard mới. Giữ backend/D1/thuật toán/Push/scanner/rollback nguyên trạng; không coi fixture QA, archive hay iPhone emulation là LIVE/PUSH/Safari thật.
