# FOOTBALL EDGE — CHECKPOINT BƯỚC 4A — 20/10/2026

## Kết quả
Hoàn thành lớp chuyển dữ liệu chỉ đọc và màn xem dữ liệu thật đã lưu trên preview riêng. CHƯA ghép vào phiên app production, CHƯA xác minh LIVE/PUSH trên giao diện tab.
Preview bố cục: https://football-edge-tabs-preview.ngophuonghuy.workers.dev/
Dữ liệu thật đã lưu: https://football-edge-tabs-preview.ngophuonghuy.workers.dev/data.html#matches
Bridge thử: /data.html?mode=bridge#overview (link riêng không đọc được phiên app chính, sẽ trống nếu không có bridge cùng trang).

Source đã kiểm thử: b75791f9eaf60b25187dd8fea0a8788c47a2541b
Preview version: af9ec3d4-d4be-4907-a28a-a61b83d0f8b9
Workflow PASS: https://github.com/Phuongdien1989/-football-edge-background-watch/actions/runs/39397798207
Artifact ID: 12253465184 (tên cũ football-edge-tabs-step3-preview).
Nhánh: feature/ft-overview-shadow-20261019, PR #12.

## Đã làm
- ui-tabs-preview/read-model.mjs đọc FEUIReadBridge.read và FEAddonBridge.masterRows, không gọi request/toggleManual/refreshEntryValidation.
- Giữ thứ hạng Master TOP đã được nguồn gán. Không cộng điểm, không tính lại TOP, không đổi Smart Follow.
- Giữ riêng tín hiệu HT/FT/HC, điểm số, lý do, thứ tự danh sách và thời gian quan sát. Danh sách engine không có rank nguồn thì không tự đặt TOP.
- Giữ FT Overview đã assess/rank trong danh sách riêng; không trộn EV vào Master TOP.
- Thêm readDisplay vào mã ứng viên ft-overview/ui.mjs để đọc bản sao các hàng đã assess trong cùng store. Không gọi store.read thêm, không render thêm hoặc tạo timer thứ hai. Thay đổi này CHƯA deploy vào Mobile chính.
- Màn chi tiết dùng đúng snapshot của cơ chế đang xem, tránh lấy tỷ số/phút từ cơ chế khác mới hơn.
- Thời gian nguồn và 0 hợp lệ được bảo toàn; dữ liệu thiếu vẫn null. Giá lệch tỷ số, line không phù hợp và cache stale không được hiển thị thành khuyến nghị mới.
- Không vẽ đường giả khi thiếu lịch sử.

## Dữ liệu thật được sử dụng
Tái sử dụng bản audit đã whitelist trong audits/2026-10-19/ft-overview-real-input-report.json; không truy vấn D1 lại.
19 fixture, quan sát ngày 17/10/2026; audit lập ngày 19/10. Đây là ARCHIVE, không phải LIVE.
15 snapshot cũ và 4 trạng thái kết thúc. Không có Master TOP hoặc thứ hạng engine trong bản ghi này.
Màn Trận đã lưu hiển thị 19 fixture; Overview TOP và các TOP engine để trống đúng nguồn.
Không lấy phút/tỷ số cũ làm dữ liệu hiện tại, không phát khuyến nghị hoặc Push từ archive.
Màn minh họa ở root vẫn dùng dữ liệu giả được gắn nhãn, tách khỏi archive và bridge.

## Kiểm thử
20 kiểm tra adapter PASS; 36 kiểm tra core FT Overview PASS.
Chromium trước phát hành + HTTPS sau phát hành PASS:
- Bố cục 375/390/414/1280, 5 tab, fixture duy nhất, không tràn.
- Chi tiết, Back, accordion, tìm kiếm, trạng thái rỗng.
- Archive 19 fixture, TOP trống, giữ thống kê/timestamp thật, không khuyến nghị.
- Bridge QA giữ rank nguồn kể cả score đảo thứ tự.
- HT/FT khác thời điểm vẫn hiện đúng snapshot của cơ chế được chọn.
- readDisplay trả bản sao; đọc không đổi store hoặc tăng số lần render.
- Không request ngoài origin, không request khi chuyển tab mẫu.
Fixture QA chỉ nằm trong context trình duyệt kiểm thử; không đưa vào app/engine/D1 thật.

## Production bảo toàn
Mobile: b73642ec-1d4c-41ae-bc28-68c785b6fd79
Backend: 04cc044d-412f-4844-9b83-c7c786eedd13
Desktop: a332ee39-abb2-422d-a021-db78ef19cc10
Các phiên bản trước/sau bằng nhau. Preview 0 binding, CSP connect-src/worker-src none.
Không gọi API bóng đá, không truy vấn/ghi D1, không bật/tắt scanner và không đăng ký Push.
Bộ đóng băng bước 1 còn nguyên; không thay hoặc diễn tập rollback production trong bước này.

## Việc còn thiếu — BƯỚC 4B
- Ghép bộ điều hướng tab vào bản ứng viên chạy cùng phiên app, đọc các bridge thật thay vì QA.
- Giữ một engine/store/timer; không nhân bản DOM ID; phối hợp route Matches/Analysis, accordion và deep links cũ.
- Đối chiếu cùng đầu vào thật giữa bản cũ và mới: score, state, rank, recommendation, timestamp.
- Kiểm tra reload/mất mạng, score change/cooldown/end-state, Browser Back, mở từ Push, ON/OFF, Safari/PWA thực tế.
- CHƯA được coi là LIVE/PUSH end-to-end PASS. Chưa đưa vào app chính hoặc thay Desktop B2.
- Không giả định preview khác origin truy cập được dữ liệu local của app production. Không sao chép token để kết nối preview.
- Production vẫn cần nghiệm thu trước khi phát hành giao diện mới.

## Chuyển khung chat
Tiếp tục repository Phuongdien1989/-football-edge-background-watch, nhánh feature/ft-overview-shadow-20261019 từ commit checkpoint mới nhất. Đọc audits/2026-10-20/UI_TABS_STEP4A_VI.md. Bước 1–3 và 4A hoàn tất; tiếp tục 4B tích hợp cùng phiên app trên bản ứng viên, không làm lại phần PASS trừ khi có thay đổi liên quan. Giữ frontend chính, backend/D1, thuật toán, Master TOP, Smart Follow, Push, scanner và rollback nguyên trạng cho đến nghiệm thu. Không gọi archive là LIVE.
