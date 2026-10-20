# FOOTBALL EDGE — CHECKPOINT BƯỚC 3

Ngày 20/10/2026. Đã hoàn thành khung giao diện tab thử riêng; chưa đưa vào app chính.

## Kết quả có thể mở xem

https://football-edge-tabs-preview.ngophuonghuy.workers.dev/

5 tab: Overview / HT Goals / FT Goals / Handicap / FT Overview.
Overview có 5 trận giả định khác nhau, nhãn cơ chế và bốn ô dẫn đầu. Các tab có danh sách riêng; chạm trận mở chi tiết; quay lại và Browser Back giữ trạng thái phần giải thích đang mở. Có tìm kiếm trận, trang Theo dõi minh họa và Cài đặt thử trạng thái rỗng.

Tất cả fixture, giá, khuyến nghị và biểu đồ trong bản này là MINH HỌA. Chưa chạy thuật toán xếp hạng, chưa nối dữ liệu hoặc engine thật. Không được thay bản production bằng mockup này.

## Mã nguồn và bằng chứng

Repository: Phuongdien1989/-football-edge-background-watch
Nhánh: feature/ft-overview-shadow-20261019 (PR #12).
Commit mã đã kiểm thử: 1dc098946c3d87a85572fb9be52ca626b11113e2.
Preview Worker: football-edge-tabs-preview.
Preview version: 970a7046-2f42-441c-a7b6-6676299ff0f6.
Workflow PASS: https://github.com/Phuongdien1989/-football-edge-background-watch/actions/runs/39395797673
Artifact: football-edge-tabs-step3-preview, ID 12251063602.
Các tệp ứng dụng: ui-tabs-preview/index.html, style.css, app.mjs.
Các tệp QA/phát hành: test-browser.cjs, release.mjs, .github/workflows/ui-tabs-preview.yml.

Kiểm thử trình duyệt Chromium trước phát hành và HTTPS sau phát hành PASS tại 375/390/414/1280px: 5 tab, 5 fixture khác nhau, không tràn ngang, chi tiết, Back, giữ accordion, tìm kiếm, trạng thái rỗng. Chuyển tab không phát sinh request; không request ra ngoài origin.
Lần CI đầu thất bại do đọc DOM trước khi hashchange render; đã sửa đồng bộ bài kiểm thử, không nới điều kiện nghiệm thu.

## Bảo toàn production

Trước/sau phát hành preview, phiên bản giữ nguyên:
- Mobile: b73642ec-1d4c-41ae-bc28-68c785b6fd79.
- Backend: 04cc044d-412f-4844-9b83-c7c786eedd13.
- Desktop: a332ee39-abb2-422d-a021-db78ef19cc10.

Preview có 0 binding; CSP chặn connect-src và worker-src. Không tải HTML/script của app cũ; không lưu token, dữ liệu người dùng, lịch sử, đăng ký Push hay kích hoạt scanner. Không query D1 và không gọi API bóng đá.
Bộ đóng băng bước 1 vẫn nguyên; việc phát hành preview không thay rollback production. Lần này không diễn tập rollback.

## Phần còn thiếu

Chưa có kiểm tra thao tác thực tế trên iPhone/Safari/PWA của người dùng. Chưa nối dữ liệu thật, chưa chứng minh điểm/khuyến nghị/rank khớp bản cũ, chưa kiểm tra Push deep link với giao diện mới. Các kiểm tra stale/error/cooldown/end-state thuộc bước nối dữ liệu và hồi quy, không coi là đã PASS từ mẫu giả định.
Màn Desktop này chỉ xác nhận không tràn, chưa thay thế dự án Desktop B2.

## Bước tiếp theo

Người dùng xem bố cục bản thử trên điện thoại trước. Khi chốt khung, tiếp tục BƯỚC 4: nối dữ liệu chỉ đọc trên bản thử, từ FEUIReadBridge và FEAddonBridge.masterRows; đọc FT Overview đã đánh giá từ cùng store hiện có, không mount engine/timer thứ hai.
Giữ Master TOP gốc, FT Overview xếp riêng; không cộng các điểm khác đơn vị, không thay Smart Follow. Không tự deploy frontend production trước nghiệm thu.
Đọc thêm audits/2026-10-20/UI_TABS_CHECKPOINT_VI.md và UI_TABS_HANDOVER.md cho kiến trúc và checkpoint đóng băng. Nội dung bước 3 trong tài liệu này mới hơn trạng thái “chưa dựng” của các tài liệu bước 1–2.

## Đoạn chuyển tiếp

Tiếp tục Football Edge nhánh feature/ft-overview-shadow-20261019 từ commit checkpoint mới nhất. Đọc audits/2026-10-20/UI_TABS_STEP3_VI.md. Bước 1–3 đã xong, workflow 39395797673 PASS; preview riêng tại football-edge-tabs-preview.ngophuonghuy.workers.dev. Chưa đưa vào app chính. Chỉ tiếp tục nối dữ liệu thật ở bước 4 khi khung giao diện đã được nghiệm thu; giữ backend, TOP, Push, scanner và rollback nguyên trạng.
