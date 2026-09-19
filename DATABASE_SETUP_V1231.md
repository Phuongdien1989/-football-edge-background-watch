# Football Edge V1.23.1 — Kích hoạt D1

## Trường hợp chưa có D1
1. Mở terminal tại thư mục deploy.
2. Chạy:
   npx wrangler d1 create football-edge-db
3. Cloudflare trả về `database_id`.
4. Mở `wrangler.toml`, bỏ dấu `#` ở block `[[d1_databases]]` cuối file và thay `REPLACE_WITH_D1_DATABASE_ID` bằng ID vừa nhận.
5. Tạo/update schema:
   npx wrangler d1 execute football-edge-db --remote --file=./schema_v1231.sql
6. Deploy Worker:
   npx wrangler deploy
7. Trong Football Edge: KẾT NỐI & CÀI ĐẶT > Nâng cao > DATABASE CENTER > KIỂM TRA D1.
8. Khi hiện `D1 READY`, bấm ĐỒNG BỘ HÀNG ĐỢI. Nếu cần, bấm ĐƯA ENTRY CŨ LÊN DATABASE.

## Trường hợp đã tạo D1 từ V1.23.0
Không tạo database mới. Chỉ cần bảo đảm `FOOTBALL_DB` binding trỏ đúng database_id, rồi chạy:
   npx wrangler d1 execute football-edge-db --remote --file=./schema_v1231.sql
   npx wrangler deploy

## Cách kiểm tra
- `/health` sẽ cho biết Worker version 1.2.1 và `d1_configured`.
- DATABASE CENTER > KIỂM TRA D1 phải hiện schema `V1.23.1`.
- REMOTE ENTRY / REMOTE LIVE sẽ tăng sau khi có dữ liệu và sync.

## Cách trích xuất
Trong app bấm `XUẤT LIVE CSV` để tải tối đa 10.000 LIVE snapshot gần nhất.
Worker cũng hỗ trợ endpoint xác thực:
- `/api/db/export/live?format=csv&limit=10000`
- `/api/db/export/entries?limit=10000`

## Lưu ý
Nếu chưa bật D1 binding hoặc database lỗi, H1/FT/HC/TOP/Entry Policy/Validation vẫn chạy bình thường. Dữ liệu chưa gửi được sẽ nằm trong IndexedDB outbox và sync lại sau.
