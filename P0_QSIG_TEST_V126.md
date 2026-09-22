# Football Edge P0 QSIG Reliability — V1.2.6 Test Gate

Không merge `p0-qsig-reliability` vào `main` trước khi các bước dưới đây pass.

## 1. Deploy branch test

```bash
git checkout p0-qsig-reliability
npm install
npx wrangler deploy
```

Sau deploy, gọi `/health` và xác nhận:

- `version = 1.2.6`
- `qsig_continuity = true`
- `h1_ht_guard = true`
- D1 configured/schema vẫn READY

## 2. App test

Dùng file app companion `index(4)_P0_QSIG_V126.html`.

Trong Background Watch > Test connection phải thấy:

- Worker 1.2.6
- QSIG ON
- số QSIG open
- local pending = 0 sau khi đăng ký thành công

Nếu hiển thị `QSIG CHƯA CÓ`, dừng test: app đang nối Worker production cũ hoặc branch chưa deploy.

## 3. Test app mở

1. Chờ một H1 hoặc FT tạo QSIG chính thức.
2. Ghi lại QSIG ID.
3. Kiểm tra `/api/qsig/list` có đúng ID đó ở trạng thái WAITING.
4. Giữ app mở qua horizon.
5. Xác nhận D1/local Validation chỉ có một record cùng ID và kết quả RESOLVED/VOID/DATA_MISSING phù hợp.

## 4. Test khóa điện thoại — gate bắt buộc

1. Chờ một QSIG H1 hoặc FT mới.
2. Chỉ khóa điện thoại sau khi `local pending = 0` và Worker đã thấy QSIG ID.
3. Khóa màn hình qua target horizon: H1 5 phút, FT 10 phút.
4. Mở lại app.
5. Background sync phải kéo kết quả về đúng QSIG ID cũ.
6. Không được tạo QSIG kết quả thứ hai.
7. D1 QSIG và Validation phải khớp kết quả.

## 5. Quy tắc kết quả

- `RESOLVED + HIT` => HIT.
- `RESOLVED + MISS` => MISS.
- `VOID` => không tính MISS.
- `DATA_MISSING` => không tính MISS.
- H1 tới HT trước khi đủ horizon => VOID.
- HC không được suy `MAINTAINED / DECAYED / REVERSED` từ tỷ số cuối trận; nếu thiếu derived HC state => DATA_MISSING.

## 6. Race-condition test

Sau khi Worker đã resolve một QSIG khi app bị khóa:

1. Mở app có local row cũ đang OPEN.
2. Chạy sync.
3. D1 terminal result phải giữ nguyên.
4. Local OPEN không được ghi đè Worker RESOLVED/VOID/DATA_MISSING.
5. App reconcile phải cập nhật local row theo Worker result.

## 7. Điều kiện cho phép merge production

Chỉ merge khi tất cả đều đúng:

- Worker health 1.2.6.
- App-open test pass.
- Lock-screen test pass.
- Same-ID/no-duplicate pass.
- Stale OPEN overwrite test pass.
- DATA_MISSING không vào MISS metrics.
- Không có thay đổi engine score, threshold, TOP ranking hoặc Entry Policy trong P0.
