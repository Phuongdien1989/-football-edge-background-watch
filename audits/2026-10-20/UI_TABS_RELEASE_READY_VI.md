# FOOTBALL EDGE — CHUẨN BỊ PHÁT HÀNH GIAO DIỆN TAB

Ngày 20/10/2026. Tiếp nối bước 5; chưa triển khai Mobile production.

## Checkpoint

- Repository: Phuongdien1989/-football-edge-background-watch.
- Nhánh: feature/ft-overview-shadow-20261019; PR #12 tiếp tục DRAFT.
- Source ứng viên: 8ef98cb4de98e11fd8c114d2dfb64319cdcc1cec.
- Workflow chuẩn bị: https://github.com/Phuongdien1989/-football-edge-background-watch/actions/runs/39407323946
- Workflow preview/Chromium: https://github.com/Phuongdien1989/-football-edge-background-watch/actions/runs/39407323930
- HTML ứng viên SHA256: 88a4a49e62fe6c6ce37445d00457d728de1c1ee55a4bc8e8b1359994ea9f3bdc.

Kết quả cuối: cả hai workflow PASS. Artifact release: 12258141905 (football-edge-tabs-release-ready). Artifact preview: 12257373451. Preview version: 2767a3f7-307a-42ca-968d-995fb04aab42, 0 binding.

Gói gồm 18 tài nguyên frontend ứng viên và 11 tài nguyên backup nguyên trạng. Đã tải artifact về, kiểm tra lại toàn bộ hash của cả hai tập tệp, PASS. Wrangler dry-run và WebKit của gói đầy đủ PASS; ba PNG đều giải mã và có kích thước đúng 180/192/512. Trước/sau, cả Mobile/backend/Desktop đều khớp version dưới đây.

## Đã chuẩn bị

`prepare-release.mjs` chỉ đọc Cloudflare: xác minh 3 production version đúng checkpoint; xác minh rollback Mobile; tải lại các tệp công khai của bản đang chạy và đối chiếu hash đã đóng băng. Lưu bản gốc vào `release-package/backup`, lắp ứng viên sạch vào `release-package/site`, tạo danh sách tệp/hash và cấu hình Wrangler.

Các tệp cũ được giữ nguyên trừ hai thay đổi UI đã nghiệm thu tự động:

1. `index.html`: thêm panel/tab, CSS và module UI.
2. `ft-overview/ui.mjs`: thêm cached readDisplay từ bước 4A để đọc cùng store, không tạo model/store mới.

Manifest, push-sw.js, /original/, /ft-overview-live/ và core/adapter/chart của FT Overview giữ nguyên byte. Ba module UI tab được thêm mới.

## Phát hiện icon cũ bị thiếu

Production đang trả HTTP 404 tại /favicon.svg và /icons/icon-180.png, icon-192.png, icon-512.png. HTML cũ tham chiếu icon 180/192; push-sw.js tham chiếu icon 192. Không có icon này trong 11 tài nguyên đóng băng hoặc trong Git tree đã kiểm tra.

Đã dùng lại favicon.svg người dùng từng gửi (nội dung SVG khớp, không đổi thiết kế). `build-icons.cjs` render thành PNG 180/192/512 bằng WebKit, kiểm tra header/kích thước PNG. Chuẩn bị bổ sung bốn URL thiếu vào ứng viên. Nếu production đã có icon hợp lệ ở lần preflight sau, giữ icon remote đó thay vì ghi đè.

Đây là sửa tài nguyên tham chiếu bị thiếu; chưa chứng minh nó là nguyên nhân khiến điện thoại không nhận thông báo. Không sửa logic Push hoặc service worker.

## Đường phát hành

`publish-candidate.mjs` yêu cầu hành động deploy/rollback rõ ràng, cờ phê duyệt và full commit SHA trùng với GITHUB_SHA cùng source của package. Kiểm tra version, cấu hình, danh sách và hash tệp trước khi gọi Wrangler.

Workflow `.github/workflows/ui-tabs-release-prepare.yml` hiện chỉ build, kiểm tra guard, preflight chỉ đọc, Wrangler dry-run và WebKit. Không có bước deploy production. Push code không phát hành app chính.

Sau khi người dùng nghiệm thu và cho phát hành, người thực hiện dùng đúng source/package đã kiểm tra trong môi trường Actions có credential đã cấu hình; gọi script phát hành với commit được duyệt. Không lấy generated/integrated.html của sandbox để deploy.

Script kiểm tra hash các URL sau phát hành, version mới và backend/Desktop. Nếu đã ghi nhận version do lần deploy này tạo và hậu kiểm lỗi, script cố rollback về version baseline; từ chối ghi đè version không khớp bản đã ghi nhận. Nếu lệnh upload lỗi trước khi ghi được version, phải kiểm tra active deployment thực tế trước khi quyết định rollback.

Chế độ rollback cần giữ `release-package/deployment.json` của đúng lần phát hành và package gốc. Không tự đổi rollback về phiên bản xa hơn.

## Version cần bảo toàn

- Mobile/rollback lần UI này: b73642ec-1d4c-41ae-bc28-68c785b6fd79.
- Backend: 04cc044d-412f-4844-9b83-c7c786eedd13.
- Desktop: a332ee39-abb2-422d-a021-db78ef19cc10.

Không sửa backend/D1/TOP/EDGE/threshold/nhịp quét/Smart Follow. Không bật scanner. Không nâng Cloudflare Paid. Không merge PR #6/#7.

## Nghiệm thu và giới hạn

Đã có kiểm thử Chromium ở bước 5; bổ sung WebKit cho ứng viên sạch, viewport/touch iPhone 13 và desktop. Test chạy trong browser tự động, không có API key hoặc dữ liệu thực. Kiểm tra kích thước và giải mã icon PNG trong browser của gói đầy đủ.

Safari/PWA trên iPhone thật, phiên cấu hình đã lưu và LIVE/PUSH end-to-end vẫn cần nghiệm thu thực tế. Không xóa local data của điện thoại để thử. Push test thật và bật scanner chỉ thực hiện trong phạm vi người dùng yêu cầu.

Gói này gồm frontend ứng viên, frontend backup, cấu hình, hash và báo cáo kiểm thử; không chứa bản sao database/backend hoặc toàn tài khoản Cloudflare. Bản backup trong gói là đúng giao diện Mobile đang chạy tại lần preflight.

## Chuyển khung chat

Tiếp tục từ checkpoint mới nhất nhánh feature/ft-overview-shadow-20261019. Đọc audits/2026-10-20/UI_TABS_RELEASE_READY_VI.md và báo cáo workflow 39407323946. UI tab chưa deploy production. Người dùng đã yêu cầu nghiệm thu trước khi áp dụng; chuẩn bị đã xong thì trình đúng ứng viên để duyệt. Sau khi được duyệt, dùng script mới và đúng commit/package có bằng chứng, giữ rollback b736. Không chạy live-release.mjs cũ, không deploy HTML sandbox, không coi WebKit emulation là iPhone/PWA hoặc LIVE/PUSH thật.
