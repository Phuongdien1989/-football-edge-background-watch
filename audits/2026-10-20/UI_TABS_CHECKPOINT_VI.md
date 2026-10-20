# FOOTBALL EDGE — BÀN GIAO GIAO DIỆN TAB
Ngày 20/10/2026. Phạm vi: đóng băng frontend hiện hành và chốt kiến trúc; chưa viết giao diện tab, chưa deploy.
## 1. Kết quả đã hoàn tất
BƯỚC 1 PASS — kiểm tra chỉ đọc trên Cloudflare lúc 15:13:27 giờ Việt Nam:
- Mobile shiny-silence-d892: b73642ec-1d4c-41ae-bc28-68c785b6fd79 (100%).
- Backend football-edge-background-watch: 04cc044d-412f-4844-9b83-c7c786eedd13.
- Desktop football-edge-desktop-b2-test: a332ee39-abb2-422d-a021-db78ef19cc10.
- Phiên bản trước/sau kiểm tra không đổi. Không deploy, không bật/tắt scanner, không gọi API bóng đá, không truy vấn D1.
- HTML Mobile SHA256: 9c557b2b20744aaad5b14ddd367517bd4afb00a7af182ead93e346f857f9947e.
- Sáu module FT Overview đang phục vụ khớp mã nguồn nhánh.
- Phiên bản Mobile hiện hành và rollback trước đó ac8c0da2-551c-4561-a554-efd4c09339ad đều tồn tại. Không diễn tập rollback lần này.
Workflow PASS: https://github.com/Phuongdien1989/-football-edge-background-watch/actions/runs/39391829038
Commit tạo bộ đóng băng: e6495e00ecc14ab075e8e6db3f8b5ace1e29db58.
Artifact: football-edge-ui-freeze-20261020, ID 12249642502.
ZIP gốc SHA256: eb9b290065431bed8c676a8ea6e5cc29cbbddf5b79e445fa67853e313b7785d6.
Bộ ZIP chứa tài nguyên frontend, mã FT Overview, hướng dẫn và bằng chứng. Không phải backup database, toàn bộ backend hay tài khoản Cloudflare. Không chứa dữ liệu người dùng hoặc secret môi trường. Các phiên bản backend/Desktop chỉ được ghi nhận để bảo vệ.
Nguồn tái tạo đầy đủ nằm tại GitHub checkpoint; thư mục source trong ZIP không thay thế toàn bộ repository.
## 2. Kiến trúc đã chốt
5 tab: Overview / HT Goals / FT Goals / Handicap / FT Overview.
- Overview giữ Master TOP gốc, tối đa 5 fixture khác nhau; mỗi dòng có nhãn cơ chế, phút/tỷ số, trạng thái và độ mới. Thêm bốn ô dẫn đầu từng cơ chế.
- FT Overview giữ TOP EV thử nghiệm riêng; không cộng EV với điểm HT/FT/HC, không sửa thuật toán TOP.
- Mỗi tab dùng dữ liệu hiện có, danh sách gọn; chạm trận mở chi tiết, quay lại giữ vị trí và trận chọn.
- Tab cố định hai hàng trên điện thoại nhỏ. Nội dung dài mở theo nhu cầu. Cài đặt, Push, lịch sử và công cụ kỹ thuật còn truy cập được.
- Giữ màu trắng/xanh dương/xanh ngọc như hình đã duyệt; không dùng dữ liệu giả không gắn nhãn.
## 3. Ràng buộc kỹ thuật
Không thay backend/D1, mô hình, ngưỡng, Push, ON/OFF, nhịp quét hoặc TOP phục vụ Smart Follow.
App có route Matches, route Analysis, accordion P1, liên kết Master và nhiều timer; phải có một bộ điều hướng phối hợp các lớp cũ.
Không nhân bản DOM có id, không mount lại engine, không thêm polling theo từng tab.
Chỉ đọc FEUIReadBridge và FEAddonBridge.masterRows; không tự gọi request/toggleManual/refreshEntryValidation.
FTOverviewPreview.read hiện xuất store, chưa có API hiển thị đầy đủ các hàng đã assess/rank cho UI tổng. Khi cần bổ sung phải là hàm chỉ đọc, không tạo store hay timer thứ hai.
Chuyển tab không gọi API, không ghi D1, không bật quét hoặc cập nhật giả timestamp.
## 4. Phần tiếp theo — BƯỚC 3
Dựng khung tab riêng bằng dữ liệu minh họa có nhãn. Không đưa vào app chính.
Preview không có binding/secrets, không service worker, CSP chặn kết nối, không dùng cấu hình/token thiết bị thật.
Dùng runtime dữ liệu thử tách biệt. Không chỉ ẩn nút rồi cho script gốc tự chạy vì script cũ có thể đồng bộ nền khi khởi động.
Bản thử đầu cần: tab, danh sách TOP, chi tiết, quay lại, trạng thái rỗng/thiếu/stale, ảnh 375/390/414px.
Sau khi nghiệm thu khung mới sang BƯỚC 4 nối dữ liệu, BƯỚC 5 hồi quy, BƯỚC 6 phát hành frontend khi được nghiệm thu.
## 5. Tiêu chí nghiệm thu
Điểm, khuyến nghị và thứ hạng cùng đầu vào khớp bản cũ.
TOP không trùng fixture; giữ nguồn của từng khuyến nghị; thiếu dữ liệu không bịa xác suất hoặc đường biểu đồ.
Chuyển tab nhiều lần không tăng request/timer; OFF vẫn OFF; không thay registry Smart Follow.
Kiểm tra browser Back, mở link fixture/Push, khôi phục trạng thái, mất mạng, bàn thắng/cooldown, trận kết thúc, tên dài và màn hình nhỏ.
Safari/PWA thực tế phải kiểm tra ở giai đoạn nghiệm thu; ảnh phác thảo không phải bằng chứng trình duyệt PASS.
## 6. Cách tiếp tục ở khung chat mới
Repository: https://github.com/Phuongdien1989/-football-edge-background-watch
Nhánh: feature/ft-overview-shadow-20261019, PR #12 đang DRAFT.
Đọc audits/2026-10-20/UI_TABS_CHECKPOINT_VI.md và UI_TABS_HANDOVER.md trên commit mới nhất, rồi tiếp tục BƯỚC 3; không làm lại bước đóng băng nếu chưa có production drift.
Không chạy ft-overview/live-release.mjs: script còn guard/rollback của lần phát hành trước. Workflow freeze chỉ đọc và không có lệnh deploy.
Không kết luận FT Overview có lợi thế cược đã chứng minh; mô hình còn thử nghiệm, chưa thêm Push mới.
Mỗi lần kết thúc bước cập nhật checkpoint: commit, workflow, đã deploy hay chưa, điều kiện PASS/FAIL, việc còn thiếu.
