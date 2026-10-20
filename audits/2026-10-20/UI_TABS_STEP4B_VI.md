# FOOTBALL EDGE — CHECKPOINT BƯỚC 4B (SANDBOX)
Ngày 20/10/2026. Đã ghép giao diện tab vào cùng trang và runtime Mobile gốc trên preview riêng. Chưa phát hành Mobile chính; chưa nghiệm thu LIVE/PUSH thật.

## Link
Bản ghép cùng runtime gốc:
https://football-edge-tabs-preview.ngophuonghuy.workers.dev/integrated.html#fe-tabs/overview
Bố cục mẫu 5 trận: https://football-edge-tabs-preview.ngophuonghuy.workers.dev/
Archive thật: https://football-edge-tabs-preview.ngophuonghuy.workers.dev/data.html#matches

Bản ghép công khai không nạp fixture mẫu tự động; nguồn trống sẽ hiện chờ dữ liệu. Quét/API/Push bị khóa. Không nhập API key vào preview.

## Source và bằng chứng
Source kiểm thử: 9e2443c1801af630b9a586d01392f1e01b9f7a34
Preview version: fb7f7bf0-89d3-494a-9163-8d5b74eb7056
Workflow PASS: https://github.com/Phuongdien1989/-football-edge-background-watch/actions/runs/39399203338
Artifact ID: 12253612027 (football-edge-tabs-step3-preview).
Repository: Phuongdien1989/-football-edge-background-watch.
Nhánh: feature/ft-overview-shadow-20261019, PR #12.

## Thay đổi
- build-integrated.mjs tái tạo HTML Mobile đang chạy, đối chiếu SHA256 9c557b2b20744aaad5b14ddd367517bd4afb00a7af182ead93e346f857f9947e.
- Thêm pane điều hướng, CSS scoped và module UI. Gỡ các phần thêm tái tạo chính xác HTML baseline.
- Không clone hoặc di chuyển các card engine/nút gốc. Không sửa công thức/threshold/Smart Follow.
- Đọc các bridge của runtime gốc ngay trong cùng document; dùng đúng FT Overview store, không tạo model/store thứ hai.
- Tab hiển thị danh sách gọn; chạm trận mở bản đọc chi tiết, có nút hiện công cụ/card gốc. Có đường trở lại bố cục cũ.
- Điều hướng phối hợp các hash fe-tabs, liên kết cũ vào H1/FT/HC và trang Matches cũ. Không nhân bản ID.
- Tab cập nhật từ sự kiện/MutationObserver, không thêm setInterval.
- Chỉ trong SANDBOX: bootstrap khóa fetch, CSP connect-src/worker-src none, tắt nút quét và input cấu hình. Wrapper timer phục vụ đo kiểm, không dành cho production.

## Kiểm thử PASS
20 adapter + 36 core regression; bố cục riêng 375/390/414/1280px.
Bản ghép cùng runtime: Chromium local và HTTPS tại 390/1280px:
- Bridge thật của mã Mobile gốc có mặt; không thay bằng mock FEUIReadBridge/FEAddonBridge.
- QA seed 3 fixture giả định vào state của runtime chỉ trong browser sandbox; so TOP hiện hữu từ FEAddonBridge với tab, khớp đúng.
- Các node/card/nút gốc và object bridge/store giữ đúng identity.
- State items và active trước/sau chuyển tab không đổi.
- Số interval không tăng; không gửi request ra ngoài origin.
- Công cụ gốc đúng cơ chế mở được; liên kết cũ và Matches navigation giữ hoạt động; không tràn ngang.
- QA fixture không được ghi vào D1/backend/production/history thật. Context browser thử nghiệm bị đóng sau kiểm tra.
Đây không phải chứng minh chất lượng dự báo hoặc LIVE/PUSH end-to-end.

## Bảo vệ production
Mobile: b73642ec-1d4c-41ae-bc28-68c785b6fd79
Backend: 04cc044d-412f-4844-9b83-c7c786eedd13
Desktop: a332ee39-abb2-422d-a021-db78ef19cc10
Trước/sau bằng nhau. Worker preview 0 binding. Không query D1, gọi API bóng đá hoặc bật/tắt scanner.
Bộ đóng băng bước 1 nguyên trạng. Chưa đổi rollback hoặc diễn tập rollback.

## Cảnh báo bắt buộc cho người tiếp nhận
KHÔNG deploy generated/integrated.html hay builder sandbox này vào production: có fetch lock, timer instrumentation và hook QA.
Hook QA chỉ được mở khi qa=1 và hostname preview/localhost, không có trên Mobile chính.
Mã production candidate phải loại hoàn toàn sandbox boot, QA hook, instrumentation, khóa nút quét và câu nhắc thử nghiệm; chỉ giữ UI/điều hướng/adapter cần thiết.
Không chạy live-release.mjs cũ: còn guard/rollback của lần phát hành trước.
Bản đóng băng cho UI tiếp theo là Mobile b73642ec-1d4c-41ae-bc28-68c785b6fd79, không tự rollback về bản xa hơn ac8/03c1.

## Phần còn lại trước phát hành
- Kiểm thử các kịch bản stale/error/cooldown/end-state và điều hướng sâu bằng runtime gốc, đồng bộ sau restart/mất mạng.
- Nghiệm thu Safari/PWA trên điện thoại.
- Chuẩn bị bản production UI candidate sạch và gói phục hồi, không mang QA/network lock.
- Kiểm chứng dữ liệu LIVE/PUSH thật cần phiên ứng dụng có dữ liệu thực. Preview khác origin không tự đọc được token/local data của app chính; không sao chép token để nối preview.
- Chỉ phát hành vào app chính sau nghiệm thu như nguyên tắc người dùng đã chốt. Chưa xác nhận LIVE/PUSH mới hoạt động.

## Chuyển khung chat
Tiếp tục Football Edge từ commit checkpoint mới nhất nhánh feature/ft-overview-shadow-20261019. Đọc audits/2026-10-20/UI_TABS_STEP4B_VI.md. Bước 1–4A và ghép sandbox 4B đã có workflow PASS 39399203338. Tiếp tục phần nghiệm thu và candidate sạch, giữ app chính/backend/D1/thuật toán/Smart Follow/Push/scanner/rollback nguyên trạng. Không làm lại các phần PASS nếu không có thay đổi liên quan, không coi fixture QA hoặc archive là LIVE.
