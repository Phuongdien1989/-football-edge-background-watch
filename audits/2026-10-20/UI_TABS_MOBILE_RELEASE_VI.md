# FOOTBALL EDGE — MOBILE TABS RELEASE

Ngày 20/10/2026. Người dùng đã duyệt giao diện và yêu cầu đổi tiêu đề Tổng hợp sang tiếng Anh, sau đó chuyển sang bước phát hành.

Tiêu đề: TOP 5 · OVERVIEW. Các tab: Overview, HT Goals, FT Goals, Handicap, FT Overview.

## Kết quả cuối đã xác minh

ĐÃ DEPLOY Mobile production thành công. Active version mới: **3c0e47ed-275b-410c-b527-77f1ff65a28a**, 100% traffic. Workflow 39409125363 PASS, gồm deploy, kiểm tra hash các URL và WebKit qua HTTPS trên app chính. Không chạy rollback vì hậu kiểm PASS.

App chính: https://shiny-silence-d892.ngophuonghuy.workers.dev/#fe-tabs/overview
Artifact: 12257814591, football-edge-tabs-mobile-release.
18 tài nguyên site và 11 tài nguyên backup đã tải về và kiểm chứng lại toàn bộ hash, PASS. Tiêu đề OVERVIEW có trong module thực tế đã phát hành, ảnh browser production xác nhận.

Backend vẫn 04cc044d-412f-4844-9b83-c7c786eedd13; Desktop vẫn a332ee39-abb2-422d-a021-db78ef19cc10. Không bật scanner, không gọi API bóng đá, không query D1. Rollback b73642ec-1d4c-41ae-bc28-68c785b6fd79 đã xác minh tồn tại trước deploy; chưa diễn tập chuyển rollback.

LIVE/PUSH trên điện thoại thật: CHƯA NGHIỆM THU. Bước tiếp theo là người dùng mở app, tải lại một lần và chủ động bật quét khi muốn dùng. Không yêu cầu reset local data/credential hoặc gỡ cài đặt PWA.

## Nguồn và kiểm thử trước phát hành

Repository: Phuongdien1989/-football-edge-background-watch.
Nhánh: feature/ft-overview-shadow-20261019, PR #12.
Commit đổi nhãn: dc130da8f0ae00a24b45acba23bee367833e8a51.
Commit phát hành: 723ae37eac825ef1fe8285c8395826b09eba35c5.

- Chuẩn bị đầy đủ / WebKit PASS: https://github.com/Phuongdien1989/-football-edge-background-watch/actions/runs/39408730147
- Chromium / preview HTTPS PASS: https://github.com/Phuongdien1989/-football-edge-background-watch/actions/runs/39408730175
- Workflow phát hành: https://github.com/Phuongdien1989/-football-edge-background-watch/actions/runs/39409125363

Lượt workflow 39408967498 lỗi cú pháp YAML ở điều kiện job; không tạo job và không chạy deploy. Đã sửa bằng scalar nhiều dòng, xác minh YAML, rồi tạo lượt phát hành 39409125363. Mã giao diện không bị thay đổi bởi sửa workflow.

## Tệp và phạm vi

18 tài nguyên frontend ứng viên, 11 tài nguyên backup cũ; manifest hash cho cả hai tập. Root HTML mới giữ nguyên phần mã runtime gốc và chỉ thêm panel/CSS/module điều hướng. UI module FT Overview có thêm readDisplay để dùng cùng store. Không thêm model hoặc xếp hạng mới.

SVG người dùng cung cấp được dùng để bổ sung favicon.svg và PNG 180/192/512 đang thiếu trên production cũ. Manifest, push-sw.js, /original/, /ft-overview-live/, core/adapter/charts giữ nguyên byte. Không thay API/backend/D1/HT/FT/HC/TOP/EDGE/ngưỡng/nhịp quét/Smart Follow.

Gói frontend không phải bản sao database hoặc toàn tài khoản Cloudflare. Bộ đóng băng trước UI vẫn còn.

## Phiên bản cần bảo toàn

- Rollback Mobile của lần phát hành này: b73642ec-1d4c-41ae-bc28-68c785b6fd79.
- Backend: 04cc044d-412f-4844-9b83-c7c786eedd13.
- Desktop: a332ee39-abb2-422d-a021-db78ef19cc10.

## Phân biệt nghiệm thu

Kiểm thử trình duyệt dùng context riêng, không có credential/dữ liệu thật trên điện thoại. Lượt HTTPS production chỉ cho tải GET/HEAD các tài nguyên frontend đã cho phép; API/endpoint khác bị browser harness chặn, service worker không đăng ký trong context QA. Không bật scanner, không gửi thử Push, không gọi API bóng đá hoặc query D1.

Kiểm tra đó chứng minh giao diện và tệp đang được phục vụ trên production; chưa chứng minh điện thoại thật nhận LIVE/PUSH. Người dùng có thể mở app cũ cùng origin và tải lại một lần; không xóa local data hoặc cài đặt ứng dụng.

## Tiếp tục phát triển

Sau phát hành, các guard preflight cũ còn pin b736 nên sẽ cố ý dừng khi chạy lại. Trước thay đổi tiếp theo, đọc đúng version mới và manifest/hash hiện hành để lập baseline mới; giữ b736 như rollback của đợt này. Không nới hoặc bỏ guard để chạy qua.

Không chạy live-release.mjs cũ, không deploy generated/integrated.html của sandbox, không tái sử dụng commit marker phê duyệt để phát hành thay đổi khác chưa được chấp thuận. PR #6/#7 và backend giữ nguyên.
