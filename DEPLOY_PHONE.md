# DEPLOY TRÊN ĐIỆN THOẠI

Bộ này đã làm phẳng để upload GitHub dễ trên iPhone.

Upload 4 file vào ROOT của repository:
1. worker.js
2. wrangler.toml
3. package.json
4. DEPLOY_PHONE.md

Sau khi upload:
Cloudflare → Workers & Pages → Create / Import repository → chọn repo
football-edge-background-watch → Deploy.

Sau đó vào Worker → Settings → Variables and Secrets:
- APISPORTS_KEY = API-Football key
- BACKGROUND_TOKEN = chuỗi bí mật tự đặt

Sau khi có URL workers.dev:
Football Edge → Cài đặt → Nâng cao → Persistent Background Watch
→ Worker URL
→ Background Token
→ Lưu
→ Kiểm tra nền
→ Đồng bộ ngay.
