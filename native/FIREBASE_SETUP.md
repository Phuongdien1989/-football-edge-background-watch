# FOOTBALL EDGE — FIREBASE / FCM SETUP

Mục tiêu: bật Native Push cho Android mà không cần cài Android Studio, Node.js hay VS Code trên laptop công ty.

## 1. Tạo Firebase project

1. Mở Firebase Console.
2. Create a project.
3. Có thể đặt tên nội bộ: `Football Edge`.
4. Google Analytics là tùy chọn, không bắt buộc cho Push.

## 2. Đăng ký Android app

Trong Firebase project:

1. Add app → Android.
2. Android package name: `vn.footballedge.app`
3. App nickname: `Football Edge Android` (tùy chọn).
4. SHA certificate chưa bắt buộc cho FCM Push cơ bản ở giai đoạn debug.
5. Register app.
6. Download `google-services.json`.

Lưu ý: package name phải chính xác và phân biệt hoa/thường. Firebase Android app đã đăng ký không thể đổi package name.

## 3. Thêm google-services.json vào GitHub Actions Secret

Không commit file này vào repo. Dù Firebase xem file này là config không chứa private key, Football Edge vẫn inject bằng GitHub Actions để giữ repo sạch.

GitHub → repo `Phuongdien1989/-football-edge-background-watch` → Settings → Secrets and variables → Actions → New repository secret.

Tên secret:

`FIREBASE_GOOGLE_SERVICES_JSON`

Giá trị: mở file `google-services.json`, copy toàn bộ JSON rồi paste vào secret.

Workflow cũng hỗ trợ secret cũ `FIREBASE_GOOGLE_SERVICES_JSON_B64`, nhưng bản raw JSON ở trên là cách đơn giản nhất khi chỉ có trình duyệt.

Cloud build sẽ tự kiểm tra file có package `vn.footballedge.app`. Nếu sai project/app, build sẽ dừng thay vì tạo APK sai cấu hình.

## 4. Bật FCM HTTP v1 và tạo server credential

Trong Firebase Console:

1. Project settings → Cloud Messaging.
2. Xác nhận Firebase Cloud Messaging API / HTTP v1 đã được bật.
3. Project settings → Service accounts.
4. Generate new private key.
5. Firebase tải về một service-account JSON chứa private key.

Đây là SECRET mạnh. Không commit file, không gửi lên repo, không dán vào issue/PR.

## 5. Cấu hình Cloudflare Worker secret

Worker production: `football-edge-background-watch`.

Trong Cloudflare Dashboard → Worker → Settings / Variables and Secrets:

Tạo encrypted secret:

`FCM_SERVICE_ACCOUNT_JSON`

Giá trị: toàn bộ nội dung của service-account JSON ở bước 4.

Backend N1 `worker_notify_v132_native.js` sẽ đọc `project_id`, `client_email`, `private_key`, tự tạo OAuth2 access token và gửi qua FCM HTTP v1.

Không cần D1 migration.

## 6. Kiểm tra readiness

Backend endpoint:

`GET /api/notify/native/capabilities`

Android sẵn sàng khi:

`fcm_configured: true`

Native app sau đó dùng Capacitor Push Notifications để lấy registration token và gọi:

`POST /api/notify/native/subscribe`

## 7. Cloud build Android

Workflow: `.github/workflows/android-native-debug.yml`

Nó sẽ:

1. lấy frozen web baseline;
2. verify SHA256;
3. inject native shell;
4. generate Android project;
5. inject `google-services.json` nếu secret tồn tại;
6. verify package `vn.footballedge.app`;
7. Capacitor sync;
8. Gradle build APK;
9. upload APK artifact.

## 8. Không thay đổi baseline

- Web/PWA Stable Baseline vẫn dùng Web Push hiện tại.
- Native Android dùng FCM.
- Native iOS sẽ dùng APNs ở bước kế tiếp.
- H1 / FT / HC / TOP Ranking / Entry Policy / Validation không bị thay đổi bởi Firebase setup.
