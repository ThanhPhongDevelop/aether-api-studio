# Aether API Studio

Website 3D tương tác để kiểm thử REST API theo kiểu Postman: soạn request, gửi HTTP thật từ server, đọc từng status, header, byte và mili-giây của response; lưu collection, quản lý biến môi trường, xem lịch sử và dashboard thống kê. Frontend React + Three.js nói chuyện với một REST API Express thật, dữ liệu lưu trong SQLite qua Prisma.

> **Trạng thái: hoàn thành cả 8 phase ✅** — 140 test backend + 41 test frontend, typecheck/lint/build sạch. Thiết kế chi tiết: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Tính năng

**API Tester (lõi của sản phẩm)**

- Method GET/POST/PUT/PATCH/DELETE/HEAD/OPTIONS, URL, query params (đồng bộ hai chiều với URL), headers (gợi ý tên header), auth **Bearer** / **Basic**, body **JSON** (tô màu cú pháp, kiểm tra lỗi, nút Format) hoặc **raw text**.
- Request được **gửi từ server** (không bị CORS của trình duyệt): theo dõi redirect, giải nén gzip/deflate/br, timeout, giới hạn kích thước, chặn SSRF.
- Response viewer: status, thời gian (chờ byte đầu / tải về), kích thước, headers, body **Pretty / Raw**, ảnh, file nhị phân; **Copy**, **Download**, xem "Request sent".
- **Biến môi trường** `{{baseUrl}}`, `{{accessToken}}`… — báo biến chưa định nghĩa, xem trước URL thật. Nút **"Save token as {{accessToken}}"** trên response đăng nhập.
- **Collections** (tạo, đổi tên, xoá, lọc), **Save / Save as / ⌘S**, đánh dấu thay đổi chưa lưu.
- **History** (tìm kiếm, lọc theo kết quả, mở lại request + response, xoá, xoá hết).
- **Import cURL** (hỗ trợ "Copy as cURL" của DevTools) và **Copy as cURL**.

**Các màn hình khác**

- **Landing 3D**: lõi tinh thể phát sáng theo status của request thật, tinh vân particles (shader riêng), bloom, depth of field, vignette, đổ bóng động, camera theo chuột và theo cuộn, smooth scrolling (Lenis), parallax.
- **Dashboard**: tổng request, thành công, thất bại, tỉ lệ thành công, thời gian phản hồi trung bình; biểu đồ theo giờ/ngày (kèm dạng bảng), phân bố status code, method, endpoint bận nhất, hoạt động gần đây. Admin xem được toàn bộ traffic API.
- **Environments**, **API Docs** (sinh từ OpenAPI 3.1 của chính API, nút "Try it"), **Products** (tìm kiếm, lọc, sắp xếp, phân trang; admin thêm/sửa/xoá), **Users** (admin), **Profile** (đổi mật khẩu, đăng xuất mọi thiết bị), **Settings** (theme, hiệu ứng 3D, giảm chuyển động, timeout, thông báo), **Notifications**, **System status**.
- Dark/light mode, sidebar responsive, command palette **⌘K / Ctrl+K**, phím tắt, toast, loading skeleton, intro loader, custom cursor, chuyển trang có hiệu ứng.

**Bảo mật**

- Access token JWT 15 phút **chỉ giữ trong bộ nhớ** (không localStorage); refresh token xoay vòng trong cookie `httpOnly` + `SameSite=Strict`, phát hiện token bị dùng lại → thu hồi cả chuỗi phiên.
- bcrypt, khoá tài khoản sau 5 lần sai, rate limit (toàn cục, đăng nhập, API Tester), Zod validate mọi input, helmet + CSP nghiêm, CORS whitelist, chống SSRF cho API Tester.
- Frontend **không chứa secret**: biến môi trường (kể cả biến secret) lưu trong database theo tài khoản, không lưu ở trình duyệt.

## Công nghệ

| Phần     | Công nghệ                                                                                                                                                                  |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frontend | React 19, TypeScript, Vite 8, Tailwind CSS 4, Framer Motion, Three.js, React Three Fiber, Drei, @react-three/postprocessing, Lenis, Recharts, TanStack Query, React Router |
| Backend  | Node.js, Express 5, Zod, Prisma 7, JWT, bcrypt, pino, helmet, express-rate-limit                                                                                           |
| Database | SQLite (driver adapter better-sqlite3); có hướng dẫn chuyển PostgreSQL                                                                                                     |
| Kiểm thử | Vitest, Supertest                                                                                                                                                          |

## Yêu cầu

- **Node.js 22.22+ hoặc 24 LTS** (khuyến nghị LTS để có sẵn binary của `better-sqlite3`)
- npm 10+
- Kết nối Internet ở lần cài đầu (npm và Prisma tải engine)

## Bắt đầu nhanh

```bash
npm install        # cài cả frontend và backend (npm workspaces), tự sinh Prisma Client
npm run setup      # tạo .env (kèm JWT secret ngẫu nhiên), chạy migration, nạp dữ liệu mẫu
npm run dev        # chạy đồng thời API :4000 và web :5173
```

Mở **http://localhost:5173**. API chạy tại **http://localhost:4000/api**.

`npm run setup` an toàn khi chạy lại: không ghi đè `.env` đã có, migration chỉ áp dụng phần còn thiếu, seed không nhân bản dữ liệu.

### Tài khoản demo

| Vai trò | Email              | Mật khẩu       |
| ------- | ------------------ | -------------- |
| Admin   | `admin@aether.dev` | `Admin@123456` |
| User    | `demo@aether.dev`  | `Demo@123456`  |

Màn hình đăng nhập có nút điền sẵn hai tài khoản này (tắt bằng `VITE_SHOW_DEMO_ACCOUNTS=false`). Mọi tài khoản — kể cả tài khoản bạn tự đăng ký — đều có sẵn collection **Quick Start** (một request mẫu cho mỗi endpoint) và môi trường **Local** đang bật.

### Thử nhanh trong 1 phút

1. Đăng nhập bằng **Demo member** → mở **API Tester**.
2. Chọn **Login (demo user)** trong Quick Start → **Send** → bấm **Save token as {{accessToken}}**.
3. Chọn **My profile** → **Send**: request dùng `Bearer {{accessToken}}` và trả về hồ sơ của bạn.
4. Mở **Dashboard** để thấy các request vừa gửi.

### Phím tắt

| Phím                      | Tác dụng                                                                                       |
| ------------------------- | ---------------------------------------------------------------------------------------------- |
| `Ctrl/⌘ + K`              | Tìm màn hình, hành động, request đã lưu                                                        |
| `Ctrl/⌘ + Enter`          | Gửi request (API Tester)                                                                       |
| `Ctrl/⌘ + S`              | Lưu request                                                                                    |
| `Ctrl/⌘ + Shift + F`      | Format body JSON                                                                               |
| `?`                       | Danh sách phím tắt                                                                             |
| `/`                       | Đưa con trỏ vào ô tìm kiếm của danh sách                                                       |
| `G` rồi `D/T/E/O/P/H/S/N` | Đi tới Dashboard / Tester / Environments / Docs / Products / Status / Settings / Notifications |

## Scripts

Chạy từ thư mục gốc:

| Lệnh                        | Tác dụng                                                            |
| --------------------------- | ------------------------------------------------------------------- |
| `npm run setup`             | Cài đặt lần đầu (thêm `-- --skip-seed` hoặc `-- --skip-db` nếu cần) |
| `npm run dev`               | Chạy API và web cùng lúc (`dev:api`, `dev:web` để chạy riêng)       |
| `npm test`                  | Chạy toàn bộ test backend và frontend                               |
| `npm run typecheck`         | Kiểm tra kiểu TypeScript cả hai workspace                           |
| `npm run lint` / `lint:fix` | ESLint toàn bộ monorepo                                             |
| `npm run format`            | Prettier                                                            |
| `npm run build`             | Build backend (`backend/dist`) và frontend (`frontend/dist`)        |
| `npm start`                 | Chạy backend đã build                                               |
| `npm run check`             | typecheck + lint + test + build — chạy trước khi commit             |
| `npm run db:migrate`        | Tạo migration mới sau khi sửa `schema.prisma`                       |
| `npm run db:deploy`         | Áp dụng migration đã có                                             |
| `npm run db:seed`           | Nạp lại dữ liệu mẫu                                                 |
| `npm run db:reset`          | **Xoá sạch** database, chạy lại migration và seed                   |
| `npm run db:studio`         | Mở Prisma Studio để xem dữ liệu                                     |

## Chạy production

Một server phục vụ cả API và giao diện (cùng origin, CSP nghiêm):

```bash
npm run build
# backend/.env: NODE_ENV=production, SERVE_FRONTEND=true, JWT secret thật
npm start          # mở http://localhost:4000
```

Lưu ý:

- Ở production, API Tester **chặn địa chỉ mạng nội bộ** (localhost, 10.x, 192.168.x…) để chống SSRF. Muốn test chính API này khi chạy production ở máy cá nhân, đặt `EXECUTOR_ALLOWED_HOSTS=localhost` (hoặc `EXECUTOR_ALLOW_PRIVATE_NETWORKS=true`). Khi triển khai công khai, đặt `PUBLIC_API_URL=https://ten-mien-cua-ban/api`.
- Cookie refresh có cờ `Secure` ở production: dùng HTTPS (trình duyệt cho phép ngoại lệ với `localhost`). Đứng sau reverse proxy thì đặt `TRUST_PROXY=1`.
- Muốn chạy frontend riêng: `npm run preview -w frontend` (proxy `/api` tới `DEV_PROXY_TARGET`).

## Cấu trúc

```text
backend/    Express API: config, routes, controllers, services, models, middleware, utils, docs, tests
frontend/   React SPA: components, pages, layouts, hooks, services, contexts, lib, assets, styles
database/   schema/ (Prisma), migrations/ (SQL), seed/ (dữ liệu mẫu)
docs/       Tài liệu kiến trúc
scripts/    setup.mjs
```

## Biến môi trường

File mẫu: [`backend/.env.example`](backend/.env.example), [`frontend/.env.example`](frontend/.env.example). `npm run setup` tự tạo `.env` từ chúng.

| Biến (backend)                                       | Mặc định                    | Ý nghĩa                                                       |
| ---------------------------------------------------- | --------------------------- | ------------------------------------------------------------- |
| `PORT`                                               | `4000`                      | Cổng API                                                      |
| `DATABASE_URL`                                       | `file:./data/aether.db`     | File SQLite, tính từ thư mục `backend/`                       |
| `CORS_ORIGINS`                                       | `http://localhost:5173,…`   | Origin được phép gọi API từ trình duyệt                       |
| `TRUST_PROXY`                                        | `0`                         | Số reverse proxy phía trước                                   |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`            | ngẫu nhiên (setup)          | Tối thiểu 32 ký tự, khác nhau; production từ chối giá trị mẫu |
| `JWT_ACCESS_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN`    | `15m`, `7d`                 | Thời hạn token                                                |
| `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX`             | `900000`, `1000`            | Giới hạn request mỗi IP cho toàn API                          |
| `AUTH_RATE_LIMIT_WINDOW_MS`, `AUTH_RATE_LIMIT_MAX`   | `900000`, `30`              | Giới hạn đăng ký / đăng nhập / đổi mật khẩu mỗi IP            |
| `LOGIN_MAX_ATTEMPTS`, `LOGIN_LOCK_MINUTES`           | `5`, `15`                   | Khoá tài khoản sau số lần sai mật khẩu liên tiếp              |
| `EXECUTOR_ALLOW_PRIVATE_NETWORKS`                    | `true` (trừ production)     | Cho API Tester gọi địa chỉ nội bộ                             |
| `EXECUTOR_ALLOWED_HOSTS`                             | trống                       | Host luôn được phép (phân tách bằng dấu phẩy)                 |
| `EXECUTOR_TIMEOUT_MS`, `EXECUTOR_MAX_RESPONSE_BYTES` | `30000`, `5242880`          | Timeout mặc định, kích thước response tối đa                  |
| `EXECUTOR_RATE_LIMIT_PER_MINUTE`                     | `120`                       | Số request API Tester mỗi người dùng mỗi phút                 |
| `PUBLIC_API_URL`                                     | `http://localhost:PORT/api` | `{{baseUrl}}` của môi trường "Local" cho tài khoản mới        |
| `SERVE_FRONTEND`                                     | `false`                     | Phục vụ `frontend/dist` từ chính server API                   |
| `METRICS_ENABLED`, `METRICS_RETENTION_DAYS`          | `true`, `30`                | Ghi và lưu giữ thống kê traffic                               |
| `LOG_LEVEL`                                          | `info`                      | `debug` để xem nhiều hơn                                      |

| Biến (frontend)           | Mặc định                | Ý nghĩa                                                |
| ------------------------- | ----------------------- | ------------------------------------------------------ |
| `VITE_API_BASE_URL`       | `/api`                  | Đường dẫn API trình duyệt gọi (qua proxy Vite khi dev) |
| `VITE_SHOW_DEMO_ACCOUNTS` | `true`                  | Hiện nút tài khoản demo ở màn hình đăng nhập           |
| `DEV_PROXY_TARGET`        | `http://localhost:4000` | Nơi proxy Vite chuyển tiếp `/api` (không vào bundle)   |

Frontend không chứa secret nào: chỉ biến có tiền tố `VITE_` được đưa vào bundle.

## Thử API bằng curl

```bash
curl http://localhost:4000/api/health
curl "http://localhost:4000/api/products?search=wireless&sort=-price&limit=5"

TOKEN=$(curl -s http://localhost:4000/api/auth/login -H "Content-Type: application/json" \
  -d '{"email":"demo@aether.dev","password":"Demo@123456"}' | node -pe "JSON.parse(require('fs').readFileSync(0)).data.accessToken")
curl http://localhost:4000/api/auth/profile -H "Authorization: Bearer $TOKEN"
```

Trên Windows PowerShell, dùng `curl.exe` thay cho `curl`. Mọi response có dạng `{ "success": true, "data": … }` hoặc `{ "success": false, "error": { "code", "message", "details", "requestId" } }`. Toàn bộ endpoint được mô tả ở `GET /api/docs` (OpenAPI 3.1) và màn hình **API docs**.

## Kiểm thử

```bash
npm test           # 140 test backend + 41 test frontend
```

- **Backend** (Vitest + Supertest): auth (đăng ký, đăng nhập, khoá tài khoản, xoay vòng/thu hồi refresh token, đổi mật khẩu), users và products (quyền admin/user, 400/401/403/404/409), workspace (collections, environments, history, quyền sở hữu), API Tester (request thật tới server test: redirect, gzip, timeout, giới hạn kích thước, chặn SSRF), dashboard, OpenAPI, phục vụ frontend + CSP, cấu hình môi trường.
- **Frontend** (Vitest): parser/xuất cURL, biến `{{…}}`, đồng bộ URL ↔ params, kho draft của API Tester, chuyển OpenAPI thành request, xử lý response, ánh xạ lỗi form, chống open redirect.

Test backend dựng database riêng `backend/data/test.db` từ chính các file migration, môi trường khép kín trong `backend/vitest.config.ts` — không đọc `.env`, không đụng database dev.

## Xử lý sự cố

| Triệu chứng                                        | Cách xử lý                                                                                                             |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `npm install` lỗi khi build `better-sqlite3`       | Dùng Node LTS (22.22+ hoặc 24) để có binary dựng sẵn; hoặc cài Visual Studio Build Tools (Windows) / Xcode CLT (macOS) |
| `prisma generate` không tải được engine            | Kiểm tra Internet/proxy; mạng bị chặn có thể đặt `PRISMA_ENGINES_MIRROR`                                               |
| Server báo `Invalid environment configuration`     | Chạy `npm run setup` hoặc sửa biến được liệt kê trong thông báo                                                        |
| Giao diện báo **API offline**                      | Backend chưa chạy — dùng `npm run dev` ở thư mục gốc (chạy cả hai server)                                              |
| API Tester báo **"That address is blocked"**       | Đang chạy production: xem mục [Chạy production](#chạy-production) (`EXECUTOR_ALLOWED_HOSTS`)                           |
| Tester báo `{{biến}}` chưa định nghĩa              | Chọn môi trường ở góc trên (ví dụ **Local**) hoặc thêm biến trong **Environments**                                     |
| Bị đăng xuất khi mở lại trình duyệt sau nhiều ngày | Refresh token hết hạn sau `JWT_REFRESH_EXPIRES_IN` (mặc định 7 ngày) — đăng nhập lại                                   |
| `Port 4000 is already in use`                      | Tắt tiến trình đang chiếm cổng hoặc đổi `PORT` (và `DEV_PROXY_TARGET` ở frontend)                                      |
| Máy yếu, cảnh 3D giật                              | Settings → tắt **3D scenes and particles**; chất lượng cũng tự giảm khi FPS thấp                                       |
| Không thấy cảnh 3D                                 | Bật hardware acceleration / WebGL trong trình duyệt; trang vẫn dùng được với nền tĩnh thay thế                         |
| Muốn làm lại dữ liệu từ đầu                        | `npm run db:reset`                                                                                                     |

## Lộ trình

| Phase | Nội dung                                                                             | Trạng thái |
| ----- | ------------------------------------------------------------------------------------ | ---------- |
| 1     | Foundation: kiến trúc, monorepo, schema, backend skeleton, frontend shell            | ✅         |
| 2     | Môi trường 3D: particles, bloom, depth of field, đổ bóng, camera theo chuột và cuộn  | ✅         |
| 3     | Bộ component giao diện, settings, profile, thông báo, command palette, phím tắt      | ✅         |
| 4     | REST API: auth, users, products (CRUD đầy đủ)                                        | ✅         |
| 5     | Tầng dữ liệu: collections, environments, history, thống kê                           | ✅         |
| 6     | API Tester kiểu Postman, tài liệu API (OpenAPI), dashboard                           | ✅         |
| 7     | Xác thực và bảo mật: xoay vòng refresh token, khoá tài khoản, rate limit, chống SSRF | ✅         |
| 8     | Kiểm thử, tối ưu, sửa lỗi                                                            | ✅         |

## Giấy phép

MIT — xem [LICENSE](LICENSE).
