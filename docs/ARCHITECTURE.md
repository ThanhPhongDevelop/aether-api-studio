# Kiến trúc Aether API Studio

Tài liệu này là bản phân tích kiến trúc của dự án: hệ thống gồm những phần nào, vì sao chọn công nghệ đó, dữ liệu được tổ chức ra sao, API trông như thế nào và dự án được xây theo 8 giai đoạn với tiêu chí nghiệm thu cụ thể.

> Trạng thái: **đã hoàn thành cả 8 giai đoạn.** Mọi endpoint, màn hình và biện pháp bảo mật mô tả dưới đây đều đã được hiện thực và có test.

---

## 1. Mục tiêu và nguyên tắc

Aether là một website 3D tương tác tích hợp **hệ thống kiểm thử REST API giống Postman**, kèm một REST API thật (auth, users, products), cơ sở dữ liệu thật và dashboard thống kê.

Bốn nguyên tắc xuyên suốt:

1. **Thật hoặc không có.** Mọi con số trên giao diện đến từ backend và database. Không có dữ liệu giả lập kết quả API; trạng thái rỗng giải thích người dùng cần làm gì.
2. **Bảo mật mặc định.** Validate mọi đầu vào, giới hạn tốc độ, header bảo mật, không có secret ở frontend, lỗi 5xx không lộ chi tiết ở production.
3. **Kiểm chứng từng giai đoạn.** Mỗi phase kết thúc bằng typecheck, lint, test và build đều xanh trước khi sang phase tiếp theo.
4. **3D phục vụ chức năng.** Hiệu ứng 3D phản ánh hoạt động thật của API (lõi phát sáng theo status code của response) và không bao giờ cản trở việc dùng trang.

---

## 2. Tổng quan hệ thống

```mermaid
flowchart LR
  subgraph Browser["Trình duyệt — React 19 SPA"]
    UI["Giao diện + Router<br/>TanStack Query"]
    R3F["Cảnh 3D<br/>Three.js + React Three Fiber"]
    Tester["API Tester"]
  end

  subgraph DevServer["Vite dev server :5173"]
    Proxy["Proxy /api"]
  end

  subgraph Api["Express 5 API :4000"]
    Pipeline["Middleware pipeline"]
    Layers["Routes → Controllers → Services"]
    Executor["Request executor + SSRF guard"]
    Metrics["Metrics recorder (ghi theo lô)"]
  end

  DB[("SQLite<br/>Prisma ORM 7")]
  External[("API bên ngoài")]

  UI -- "fetch /api/*" --> Proxy --> Pipeline --> Layers --> DB
  Tester -- "POST /api/requests/execute" --> Proxy
  Layers --> Executor -- "HTTP thật" --> External
  Pipeline --> Metrics --> DB
  R3F -. "xung theo status code" .- UI
```

- **Development:** trình duyệt chỉ nói chuyện với `localhost:5173`; Vite chuyển tiếp `/api/*` sang Express. Cùng origin nên không cần CORS và cookie `SameSite=Strict` hoạt động.
- **Production:** `SERVE_FRONTEND=true` — Express phục vụ luôn bản build tĩnh của frontend (một origin, một tiến trình, CSP nghiêm, asset có hash được cache lâu dài), hoặc frontend triển khai riêng và backend bật CORS cho đúng origin đó.

---

## 3. Quyết định công nghệ

| Hạng mục     | Lựa chọn                                                | Lý do                                                                                                   | Đã cân nhắc                                                                                 |
| ------------ | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Frontend     | **Vite 8 + React 19 + TypeScript** (SPA)                | Backend tách riêng đúng yêu cầu "frontend kết nối backend"; R3F chạy hoàn toàn phía client; build nhanh | Next.js — SSR không mang lại lợi ích cho ứng dụng dạng công cụ, thêm độ phức tạp khi deploy |
| Định tuyến   | **React Router 8** (data router, `lazy`)                | Mỗi trang là một chunk riêng                                                                            | —                                                                                           |
| Server state | **TanStack Query 5**                                    | Cache, polling, retry, huỷ request khi rời trang                                                        | Tự viết hook — phải tự lo cache/retry                                                       |
| UI state     | **React Context** (theme; auth, toast ở các phase sau)  | Đủ cho phạm vi dự án                                                                                    | Redux/Zustand — chưa cần                                                                    |
| Styling      | **Tailwind CSS 4** + design tokens bằng CSS variables   | Đổi theme dark/light chỉ bằng một class trên `<html>`                                                   | CSS-in-JS — chi phí runtime                                                                 |
| Animation    | **Framer Motion** (UI), `useFrame` (3D)                 | Animation phản hồi thao tác; vòng render 3D riêng                                                       | GSAP — không cần thiết khi đã có Framer Motion                                              |
| 3D           | **Three.js + React Three Fiber 9 + Drei 10**            | Khai báo cảnh 3D bằng component, tận dụng hệ sinh thái Drei                                             | Three.js thuần — nhiều code thủ công                                                        |
| Backend      | **Express 5** + TypeScript                              | Lỗi từ hàm async tự đi vào error handler; hệ sinh thái lớn                                              | Fastify, NestJS                                                                             |
| Validation   | **Zod 4**                                               | Một schema vừa validate vừa sinh type (env, params, query, body)                                        | Joi, class-validator                                                                        |
| ORM          | **Prisma 7** + driver adapter `better-sqlite3`          | Client TypeScript thuần, không cần Rust engine lúc chạy; type-safe                                      | TypeORM, Drizzle                                                                            |
| Database     | **SQLite** (mặc định)                                   | Không cần cài server DB, clone về là chạy                                                               | PostgreSQL — có hướng dẫn chuyển ở mục 6.4                                                  |
| Auth         | **JWT** access token ngắn hạn + refresh token xoay vòng | Không trạng thái ở access token, thu hồi được nhờ refresh token lưu DB                                  | Session cookie thuần                                                                        |
| Logging      | **pino** + `pino-http`                                  | JSON có cấu trúc, mỗi dòng mang request id                                                              | winston, morgan                                                                             |
| Kiểm thử     | **Vitest 5 + Supertest**                                | Nhanh, cùng hệ sinh thái Vite, test HTTP in-process                                                     | Jest                                                                                        |
| Monorepo     | **npm workspaces**                                      | Một lệnh cài, một lệnh chạy cả hai server                                                               | Turborepo, pnpm — thêm công cụ                                                              |

**Ghim phiên bản có chủ đích** (tháng 11/2026):

- `prisma@7.10.1` — dist-tag `latest` của gói CLI đang trỏ vào bản RC 8.0, trong khi `@prisma/client` vẫn là 7.10.1. CLI và client phải cùng phiên bản.
- `typescript@~6.0` — TypeScript 7 (bản viết lại bằng Go) chưa được `typescript-eslint` hỗ trợ (`<6.1.0`).

---

## 4. Cấu trúc thư mục

```text
aether-api-studio/
├── backend/                     Express API (workspace @aether/backend)
│   ├── src/
│   │   ├── config/              env (Zod), logger, database (Prisma), CORS
│   │   ├── routes/              Khai báo endpoint, gắn middleware
│   │   ├── controllers/         Dịch HTTP ↔ service; không chứa nghiệp vụ
│   │   ├── services/            Nghiệp vụ: auth, token, users, products, workspace, executor, dashboard…
│   │   ├── models/              Hợp đồng dữ liệu trả về (DTO) và mapper
│   │   ├── middleware/          Logger, metrics, rate limit, validate, 404, error handler
│   │   ├── utils/               AppError, response envelope, format, phân trang, mật khẩu, router factory
│   │   ├── docs/                Đặc tả OpenAPI 3.1 (GET /api/docs)
│   │   ├── types/               Mở rộng type cho Express
│   │   ├── generated/prisma/    Prisma Client (sinh tự động, không commit)
│   │   ├── app.ts               Dựng ứng dụng Express (không listen → test được)
│   │   └── server.ts            Khởi động HTTP server, graceful shutdown
│   ├── tests/                   unit/ và integration/ (Vitest + Supertest)
│   ├── data/                    File SQLite cục bộ (không commit)
│   └── prisma.config.ts         Cấu hình Prisma CLI → trỏ tới database/
├── frontend/                    React SPA (workspace @aether/frontend)
│   └── src/
│       ├── components/          ui/, three/, tester/, dashboard/, navigation/, command/, effects/, feedback/…
│       ├── pages/               Mỗi trang một chunk lazy
│       ├── layouts/             AppLayout (sidebar, header, palette), AuthLayout (form + lõi 3D)
│       ├── hooks/               useAuth, useWorkspace, useCatalog, useHotkey, useUrlState, useTester…
│       ├── services/            api-client (token, refresh, ApiError), auth, catalog, account, workspace
│       ├── contexts/            Theme, Auth, Toast, Confirm
│       ├── config/              Hằng số ứng dụng, điều hướng
│       ├── lib/                 Logic thuần có test: cURL, biến, URL↔params, tester store, OpenAPI, format…
│       ├── types/               Hợp đồng API (đối xứng với backend/src/models)
│       ├── assets/              Tài nguyên tĩnh (noise texture)
│       └── styles/              Design tokens + Tailwind
├── database/
│   ├── schema/schema.prisma     Nguồn sự thật duy nhất của mô hình dữ liệu
│   ├── migrations/              Migration SQL (commit vào git)
│   └── seed/                    Dữ liệu mẫu idempotent
├── docs/ARCHITECTURE.md
├── scripts/setup.mjs            Cài đặt một lệnh, chạy được trên Windows/macOS/Linux
└── .github/workflows/ci.yml     Typecheck, lint, test, build trên mỗi push/PR
```

Quy tắc phụ thuộc giữa các lớp backend: `routes → controllers → services → Prisma`. Controller không gọi Prisma trực tiếp; service không biết gì về `req`/`res`. Nhờ vậy nghiệp vụ test được độc lập với HTTP.

---

## 5. Backend

### 5.1 Vòng đời một request

```mermaid
sequenceDiagram
  autonumber
  participant B as Browser
  participant P as Vite proxy
  participant M as Middleware
  participant R as Router + validate
  participant C as Controller
  participant S as Service
  participant D as Prisma / SQLite

  B->>P: GET /api/status
  P->>M: chuyển tiếp
  M->>M: request id, access log, helmet, CORS, metrics, rate limit, body parser
  M->>R: khớp route
  R->>C: tham số đã validate (Zod)
  C->>S: getStatusReport()
  S->>D: truy vấn song song
  D-->>S: kết quả
  S-->>C: StatusReport
  C-->>B: 200 { success: true, data }
  Note over M,C: Bất kỳ lỗi nào → error handler → { success: false, error }
  M-)D: ghi ApiLog theo lô sau khi response kết thúc
```

Thứ tự middleware trong `app.ts` có chủ đích:

| #   | Middleware                            | Vì sao đặt ở đây                                                                       |
| --- | ------------------------------------- | -------------------------------------------------------------------------------------- |
| 1   | `pino-http` (request id + access log) | Mọi dòng log sau đó đều mang request id; header `X-Request-Id` được trả về để truy vết |
| 2   | `helmet`                              | Header bảo mật có mặt cả trên response lỗi                                             |
| 3   | `cors`                                | Response 429/4xx vẫn đọc được từ trình duyệt                                           |
| 4   | `apiMetrics`                          | Ghi nhận cả request bị rate limit hoặc lỗi                                             |
| 5   | `rateLimit`                           | Chặn sớm trước khi tốn CPU parse body                                                  |
| 6   | `express.json` (giới hạn 1 MB)        | JSON hỏng → 400 `INVALID_JSON`, quá lớn → 413                                          |
| 7   | Routes                                | `validate()` của từng route chạy tại đây                                               |
| 8   | `notFoundHandler`                     | 404 `ROUTE_NOT_FOUND`, không lặp lại query string (có thể chứa token)                  |
| 9   | `errorHandler`                        | Chuẩn hoá mọi lỗi về một envelope                                                      |

### 5.2 Định dạng response

Thành công:

```json
{ "success": true, "data": { "…": "…" }, "meta": { "page": 1, "limit": 10, "total": 12 } }
```

Thất bại:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [{ "path": "body.email", "message": "Invalid email address", "code": "invalid_format" }],
    "requestId": "c0bd644c-e9a0-477d-b26d-121284ec7a81"
  }
}
```

| HTTP | `error.code`                    | Khi nào                                                                  |
| ---- | ------------------------------- | ------------------------------------------------------------------------ |
| 400  | `VALIDATION_ERROR`              | Params/query/body sai schema (liệt kê mọi lỗi cùng lúc)                  |
| 400  | `INVALID_JSON`                  | Body JSON không parse được                                               |
| 401  | `UNAUTHORIZED`                  | Thiếu, sai hoặc hết hạn token                                            |
| 403  | `FORBIDDEN`                     | Không đủ quyền                                                           |
| 404  | `NOT_FOUND` / `ROUTE_NOT_FOUND` | Không có bản ghi / không có route                                        |
| 409  | `CONFLICT`                      | Trùng giá trị unique (Prisma P2002), vi phạm khoá ngoại (P2003)          |
| 413  | `PAYLOAD_TOO_LARGE`             | Body vượt 1 MB                                                           |
| 415  | `UNSUPPORTED_MEDIA_TYPE`        | Encoding/charset không hỗ trợ                                            |
| 429  | `RATE_LIMITED`                  | Vượt giới hạn; kèm header `RateLimit`, `RateLimit-Policy`, `Retry-After` |
| 500  | `INTERNAL_ERROR`                | Lỗi ngoài dự kiến; message bị ẩn ở production                            |
| 503  | `SERVICE_UNAVAILABLE`           | `/api/health` khi database không phản hồi                                |

### 5.3 Cấu hình và môi trường

`src/config/env.ts` đọc `backend/.env` (không ghi đè biến môi trường thật), validate bằng Zod và **dừng tiến trình ngay khi khởi động** nếu cấu hình sai, kèm hướng dẫn sửa. Ở production, secret mẫu (`replace-with…`) bị từ chối. Test dùng môi trường khép kín trong `vitest.config.ts` và không bao giờ đọc `.env` của bạn.

### 5.4 Quan sát hệ thống

- **`GET /api/health`** — dành cho load balancer/uptime monitor: 200 khi database trả lời `SELECT 1`, 503 khi không.
- **`GET /api/status`** — dành cho con người và dashboard: luôn trả 200 kèm chi tiết (uptime, phiên bản, bộ nhớ, số bản ghi, thống kê traffic 24 giờ). Trạng thái tổng `ok | degraded | down`: `degraded` khi database chậm hơn 1 giây hoặc tỉ lệ 5xx vượt 5% (tối thiểu 20 request).
- **Traffic metrics** — middleware `apiMetrics` ghi mỗi request `/api/*` (method, path, route pattern như `/api/users/:id`, status, thời gian) vào bộ đệm, ghi xuống bảng `api_logs` theo lô mỗi 2 giây hoặc mỗi 100 dòng, nên không làm chậm request. Health probe được loại trừ. Dữ liệu cũ hơn `METRICS_RETENTION_DAYS` bị xoá khi khởi động.
- **Graceful shutdown** — `SIGINT`/`SIGTERM`: ngừng nhận kết nối, ghi nốt metrics, đóng Prisma, tối đa 10 giây.

---

## 6. Dữ liệu

### 6.1 Mô hình quan hệ

```mermaid
erDiagram
  User ||--o| UserSettings : "cài đặt"
  User ||--o{ RefreshToken : "phiên đăng nhập"
  User ||--o{ Product : "tạo"
  User ||--o{ Collection : "sở hữu"
  User ||--o{ SavedRequest : "sở hữu"
  Collection ||--o{ SavedRequest : "nhóm"
  User ||--o{ RequestHistory : "đã gửi"
  User ||--o{ Environment : "sở hữu"
  Environment ||--o{ EnvironmentVariable : "định nghĩa"
  User ||--o{ Notification : "nhận"

  User {
    int id PK
    string email UK
    string passwordHash
    Role role
    boolean isActive
  }
  Product {
    int id PK
    string slug UK
    float price
    int stock
    string category
  }
  SavedRequest {
    string id PK
    HttpMethod method
    string url
    json headers
    json queryParams
    BodyType bodyType
    AuthType authType
  }
  RequestHistory {
    string id PK
    int statusCode
    int durationMs
    int responseSize
  }
  ApiLog {
    int id PK
    string route
    int statusCode
    float durationMs
  }
```

### 6.2 Ghi chú thiết kế

- **ID số nguyên cho `User` và `Product`** để dễ gõ khi thử API (`GET /api/products/3`); các tài nguyên của API Tester dùng `cuid` vì không cần đoán được.
- **Headers, query params, auth của request đã lưu** là cột `Json` — cấu trúc linh hoạt, luôn đọc/ghi trọn khối.
- **Refresh token** chỉ lưu dạng HMAC-SHA256; cột `family` gom một chuỗi xoay vòng để khi phát hiện token cũ bị dùng lại thì thu hồi cả chuỗi.
- **`ApiLog` không có khoá ngoại** tới `User`: log không bao giờ được cản việc xoá người dùng hay làm hỏng cả lô ghi.
- **Xoá theo chuỗi** (`onDelete: Cascade`) cho mọi dữ liệu thuộc về người dùng; `Product.createdBy` chuyển về `NULL` khi người tạo bị xoá. Integration test xác nhận SQLite thực sự thi hành khoá ngoại.
- **Index** đặt theo truy vấn thật: `request_history(userId, createdAt)` cho lịch sử theo người dùng, `api_logs(createdAt)` cho cửa sổ 24 giờ, `api_logs(route)` cho thống kê theo endpoint.

### 6.3 Migration và seed

- `database/schema/schema.prisma` là nguồn sự thật. Đổi schema → `npm run db:migrate -- --name <tên>` sinh migration mới trong `database/migrations/`.
- `npm run db:deploy` áp dụng migration đã commit (dùng khi cài mới và ở production).
- `npm run db:seed` nạp dữ liệu mẫu **idempotent**: user khớp theo email, product theo slug, collection/environment theo (chủ sở hữu, tên). Chạy lại bao nhiêu lần cũng không nhân bản dữ liệu.
- Test dựng database riêng `backend/data/test.db` từ chính các file migration trước mỗi lần chạy, nên schema của test luôn giống production.

### 6.4 Chuyển sang PostgreSQL (tuỳ chọn)

1. `npm install -w backend @prisma/adapter-pg pg`
2. Trong `schema.prisma`: `provider = "postgresql"`.
3. `DATABASE_URL=postgresql://user:pass@localhost:5432/aether` và nới điều kiện `startsWith('file:')` trong `env.ts`.
4. Trong `config/database.ts`: dùng `new PrismaPg({ connectionString })` thay cho adapter SQLite.
5. Migration SQLite không dùng chung được cho PostgreSQL: tạo thư mục migration mới bằng `npm run db:migrate -- --name init`.

---

## 7. Danh mục API

Tất cả nằm dưới `/api`, trả envelope `{ success, data, meta? }` hoặc `{ success: false, error }`. Mô tả đầy đủ (tham số, ví dụ body, mã lỗi) có ở `GET /api/docs` (OpenAPI 3.1) và màn hình **API docs**.

| Nhóm           | Endpoint                                                                                                                                                      | Quyền                                    |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| System         | `GET /`, `GET /health` (200/503), `GET /status`, `GET /docs`                                                                                                  | Công khai                                |
| Auth           | `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh` (cookie), `POST /auth/logout`                                                                 | Công khai                                |
| Auth           | `GET /auth/profile`, `PATCH /auth/profile`, `POST /auth/change-password`, `POST /auth/logout-all`                                                             | Đã đăng nhập                             |
| Users          | `GET /users` (`page`, `limit`, `search`, `role`, `isActive`, `sort`), `POST /users`, `DELETE /users/:id`                                                      | Admin                                    |
| Users          | `GET /users/:id`, `PUT /users/:id`, `PATCH /users/:id` (đổi role/trạng thái chỉ admin)                                                                        | Admin hoặc chính chủ                     |
| Products       | `GET /products` (`search`, `category`, `minPrice`, `maxPrice`, `inStock`, `status`, `sort`, `page`, `limit`), `GET /products/categories`, `GET /products/:id` | Công khai (admin thấy cả sản phẩm ẩn)    |
| Products       | `POST /products`, `PUT /products/:id`, `PATCH /products/:id`, `DELETE /products/:id`                                                                          | Admin                                    |
| Settings       | `GET /settings`, `PATCH /settings`, `PUT /settings`                                                                                                           | Đã đăng nhập                             |
| Notifications  | `GET /notifications`, `GET /notifications/unread-count`, `POST /notifications/read-all`, `PATCH /notifications/:id/read`, `DELETE /notifications/:id`         | Đã đăng nhập (chỉ của mình)              |
| Collections    | `GET /collections`, `POST /collections`, `GET/PATCH/DELETE /collections/:id`                                                                                  | Đã đăng nhập (chỉ của mình)              |
| Saved requests | `GET /saved-requests?collectionId=`, `POST /saved-requests`, `GET/PUT/DELETE /saved-requests/:id`                                                             | Đã đăng nhập (chỉ của mình)              |
| Environments   | `GET /environments`, `POST /environments`, `PUT/DELETE /environments/:id`, `POST /environments/:id/activate`, `POST /environments/deactivate`                 | Đã đăng nhập (chỉ của mình)              |
| History        | `GET /history` (`search`, `method`, `status`), `GET/DELETE /history/:id`, `DELETE /history`                                                                   | Đã đăng nhập (chỉ của mình)              |
| API Tester     | `POST /requests/execute`                                                                                                                                      | Đã đăng nhập, rate limit theo người dùng |
| Dashboard      | `GET /dashboard/stats?range=24h\|7d\|30d&tzOffset=` (`scope=server` chỉ admin)                                                                                | Đã đăng nhập                             |

Tài nguyên của người khác luôn trả **404** (không tiết lộ là có tồn tại). Mã lỗi ổn định: `VALIDATION_ERROR`, `UNAUTHORIZED`, `INVALID_TOKEN`, `TOKEN_EXPIRED`, `INVALID_CREDENTIALS`, `ACCOUNT_LOCKED`, `ACCOUNT_DISABLED`, `REFRESH_TOKEN_REUSED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `LAST_ADMIN`, `CANNOT_DELETE_SELF`, `TARGET_NOT_ALLOWED`, `RATE_LIMITED`.

---

## 8. Thiết kế API Tester

```mermaid
flowchart LR
  Compose["Soạn request<br/>method, URL, headers,<br/>params, auth, body"] --> Resolve["Thay biến {{baseUrl}}<br/>từ environment đang bật"]
  Resolve --> Execute["POST /api/requests/execute"]
  Execute --> Guard{"SSRF guard"}
  Guard -- "cho phép" --> Target["Gửi HTTP thật,<br/>đo thời gian và kích thước"]
  Guard -- "chặn" --> Reject["400 TARGET_NOT_ALLOWED"]
  Target --> Store["Lưu RequestHistory"]
  Store --> View["Status, thời gian, kích thước,<br/>headers, JSON pretty, raw"]
```

**Vì sao thực thi phía server:** trình duyệt bị CORS chặn với đa số API bên ngoài và không đọc được mọi response header; thực thi phía server đo thời gian và kích thước chính xác, đồng thời ghi lịch sử cho dashboard. Nền móng phía trình duyệt (`services/http-probe.ts` — đo status, thời gian, kích thước, request id) được dùng cho ô "thử ngay" trên landing page và trang System status.

**Bảo vệ SSRF** (một API cho phép "gửi request tới URL bất kỳ" là mục tiêu tấn công kinh điển):

- Chỉ `http:`/`https:`; phân giải DNS trước rồi chặn các dải private, loopback, link-local và metadata đám mây (`10/8`, `172.16/12`, `192.168/16`, `127/8`, `169.254/16`, `::1`, `fc00::/7`, `fe80::/10`). Riêng API của chính ứng dụng được phép ở môi trường development.
- Kiểm tra lại địa chỉ sau mỗi lần redirect (chống DNS rebinding), giới hạn số redirect.
- Timeout (mặc định 30 giây, theo cài đặt người dùng), giới hạn response 5 MB, rate limit riêng cho endpoint execute.

Phía giao diện (`pages/TesterPage.tsx`, `components/tester/*`, `lib/tester-store.ts`):

- **Draft** nằm trong một store cấp module (`useSyncExternalStore`): giữ nguyên khi chuyển màn hình, **chỉ trong bộ nhớ** (draft có thể chứa token/mật khẩu nên không bao giờ ghi vào storage của trình duyệt).
- **URL ↔ Params** đồng bộ hai chiều không mất dữ liệu (`lib/query-string.ts`): URL là nguồn sự thật cho tham số đang bật, dòng bị tắt chỉ nằm trong bảng; giá trị giữ nguyên như gõ nên `{{biến}}` không bị encode.
- **Biến môi trường** được thay ở URL, header, auth và body ngay trước khi gửi (`lib/interpolate.ts`); biến thiếu trong URL chặn việc gửi kèm hướng dẫn, thiếu ở chỗ khác thì cảnh báo.
- **Lưu** tách URL gốc và toàn bộ dòng params (kể cả dòng tắt); **history** khôi phục request nhưng bỏ header do executor tự thêm và header đã bị che (`••••••`).
- **cURL**: parser hiểu quoting của bash, chuỗi `$'…'`, cờ gộp (`-sSL`, `-XPOST`), `--json`, `-G`, `--data-urlencode`, `-u`, chuyển header `Authorization` sang tab Auth; xuất ngược bằng `toCurl`.
- **Response**: status, thời gian chờ byte đầu và tải về, kích thước, redirect, headers, body Pretty/Raw, ảnh, nhị phân (base64), Copy, Download, "Request sent" (che credential, có nút hiện), nút lưu token đăng nhập vào `{{accessToken}}`.

---

## 9. Bảo mật

| Rủi ro                         | Biện pháp đã hiện thực                                                                                                                                    |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lộ mật khẩu                    | bcrypt (cost 12), không bao giờ trả `passwordHash`, log tự che `password`/`token`; saved request không bao giờ chứa mật khẩu                              |
| Đánh cắp token qua XSS         | Access token 15 phút chỉ nằm trong bộ nhớ; refresh token trong cookie `httpOnly`, `SameSite=Strict`, `Path=/api/auth`, `Secure` ở production              |
| Token bị dùng lại              | Refresh token xoay vòng mỗi lần dùng, lưu dạng HMAC; dùng lại token cũ → thu hồi cả chuỗi phiên (cho phép 10 giây cho hai tab cùng refresh)               |
| Dò mật khẩu                    | Rate limit toàn cục + riêng cho register/login/change-password; khoá tài khoản 15 phút sau 5 lần sai; thời gian phản hồi như nhau khi email không tồn tại |
| Tài khoản bị vô hiệu           | Token của tài khoản bị khoá/xoá bị từ chối ngay; đổi mật khẩu hoặc vô hiệu hoá thu hồi mọi phiên                                                          |
| Dữ liệu đầu vào độc hại        | Zod validate params/query/body; body tối đa 1 MB; header name/value của API Tester được kiểm tra                                                          |
| SQL injection                  | Prisma dùng truy vấn tham số hoá                                                                                                                          |
| Gọi API trái phép từ site khác | CORS theo whitelist origin, có credentials; cookie `SameSite=Strict`                                                                                      |
| XSS / clickjacking             | Helmet + CSP (`script-src 'self'`, `frame-ancestors 'none'`, `object-src 'none'`); không dùng `innerHTML` — body response được tô màu bằng React element  |
| SSRF qua API Tester            | Xem mục 8; chặn mặc định ở production, kiểm tra lại mỗi lần redirect                                                                                      |
| Open redirect sau đăng nhập    | Tham số `next` chỉ nhận đường dẫn nội bộ (`lib/navigation.ts`)                                                                                            |
| Lộ secret ở frontend           | Chỉ biến `VITE_*` vào bundle; biến môi trường (kể cả secret) lưu trong DB theo tài khoản, `localStorage` chỉ chứa lựa chọn theme                          |
| Lộ chi tiết lỗi                | Message 5xx bị ẩn ở production; `requestId` để truy vết                                                                                                   |
| Log rò rỉ thông tin            | Serializer tối giản (không header, không body), redact `authorization`/`cookie`; history che `Authorization`, `Cookie`, `X-API-Key`                       |
| Thông tin runtime              | `/api/status` không chứa secret; phiên bản Node, bộ nhớ và số bản ghi công khai có chủ ý cho trang System status — chặn ở reverse proxy nếu không muốn    |

---

## 10. Frontend

### 10.1 Định tuyến và tách mã

Mỗi trang là một chunk tải khi cần (`lazy` của React Router). Three.js nằm trong chunk riêng chỉ tải khi trang có cảnh 3D, nên bundle ban đầu nhỏ. `HydrateFallback` hiển thị trong lúc tải chunk đầu tiên; thanh tiến trình mảnh hiện khi chuyển trang.

### 10.2 Quản lý trạng thái

- **Phiên đăng nhập** (`lib/auth-store.ts`, `contexts/auth`): access token trong bộ nhớ; khi tải trang, phiên được khôi phục bằng `POST /auth/refresh` (cookie). `api-client.ts` tự gắn `Authorization`, gặp `TOKEN_EXPIRED`/`INVALID_TOKEN` thì refresh **một lần dùng chung** (single-flight, vì mỗi lần refresh xoay vòng cookie) rồi gửi lại; token được làm mới trước khi hết hạn 60 giây. Đăng nhập/đăng xuất được đồng bộ giữa các tab bằng `BroadcastChannel`; dữ liệu riêng tư trong cache bị xoá khi phiên kết thúc.
- **Server state:** TanStack Query cho mọi dữ liệu API (giữ kết quả cũ mờ đi khi đổi bộ lọc thay vì nháy skeleton; mutation cập nhật lạc quan cho settings).
- **Bộ lọc danh sách** (products, users) nằm trên URL (`hooks/useUrlState.ts`): chia sẻ được, quay lại được; ô tìm kiếm và khoảng giá được debounce.
- **UI state:** `ThemeProvider` (dark/light/system; `public/theme-init.js` áp theme trước lần vẽ đầu — tách khỏi HTML để CSP cấm được inline script), `ToastProvider`, `ConfirmProvider` (`await confirm({...})`), `Preferences` đồng bộ theme và "giảm chuyển động" từ cài đặt tài khoản (CSS + `MotionConfig`).
- **Lỗi API:** mọi lời gọi đi qua `api-client.ts`, bóc envelope và ném `ApiError` (status, code, details, requestId); `lib/form-errors.ts` ánh xạ lỗi validate/409 về đúng ô của form.

### 10.3 Hệ thống thiết kế

| Token                       | Dark                                          | Light                    | Vai trò                   |
| --------------------------- | --------------------------------------------- | ------------------------ | ------------------------- |
| Abyss                       | `#070B1A`                                     | `#EEF1FA`                | Nền                       |
| Nebula                      | `rgb(24 33 74 / .42)`                         | `rgb(255 255 255 / .62)` | Bề mặt kính               |
| Starlight                   | `#E8ECFF`                                     | `#0B1030`                | Chữ chính                 |
| Ion                         | `#5BE7FF`                                     | `#0379A0`                | Accent tương tác duy nhất |
| ok / redirect / warn / fail | `#2EE6A6` / `#7AA2FF` / `#FFB547` / `#FF5C7A` | bản đậm hơn              | 2xx / 3xx / 4xx / 5xx     |

- **Màu mang nghĩa HTTP ở mọi nơi:** status code và method (GET xanh lá, POST hổ phách, PUT xanh dương, PATCH tím, DELETE hồng) dùng cùng một bảng màu trên trang status, live probe, API tester và dashboard.
- **Gradient quang phổ** chỉ dùng cho logo và lõi 3D, để chúng là điểm nhấn duy nhất.
- **Typography:** Unbounded (tiêu đề, dạng rộng), IBM Plex Sans (giao diện, hỗ trợ tiếng Việt), IBM Plex Mono (chỉ cho URL, JSON, mã). Font tự host qua `@fontsource`, không gọi Google Fonts.

### 10.4 Chiến lược hiệu năng 3D

- Canvas tải lười; có fallback tĩnh khi trình duyệt không hỗ trợ WebGL hoặc cảnh 3D lỗi (error boundary riêng, không kéo sập trang).
- `dpr` giới hạn 1–1.75 và tự hạ khi FPS giảm (`PerformanceMonitor`).
- Không cấp phát object trong vòng frame: xung sóng dùng pool 6 vòng tái sử dụng; geometry tạo một lần và được giải phóng khi unmount.
- Environment map dựng thủ tục bằng `Lightformer` (`frames={1}`), không tải file HDR từ mạng.
- Hoạt ảnh bắt đầu ở frame thực sự được vẽ tiếp theo, nên tab bị ẩn hay main thread bận không làm mất hiệu ứng.
- `prefers-reduced-motion`: dừng tự xoay và trôi nổi, bỏ sóng lan, chỉ giữ ánh sáng phản hồi.
- Cảnh không chiếm thao tác cuộn: lăn chuột chỉ zoom sau khi người dùng bấm vào cảnh; trên màn hình cảm ứng, điều khiển chỉ bật sau khi chạm.
- **Landing** (`components/three/HeroScene.tsx`): tinh vân particles bằng `ShaderMaterial` riêng (vị trí sinh bằng PRNG có seed nên render thuần và ổn định), nền nhận bóng đổ động từ spotlight, camera theo chuột (parallax) và theo tiến độ cuộn của hero, post-processing Bloom + Depth of Field + Vignette. Máy yếu (hoặc FPS tụt) tự chuyển sang chế độ thấp: bỏ DOF, giảm particles và `dpr`.
- Nền particles 2D cho các màn hình ứng dụng dùng canvas 2D (rẻ hơn WebGL), dừng khi tab ẩn; custom cursor chỉ bật với chuột, không bật khi giảm chuyển động. Mọi hiệu ứng tắt được trong Settings.

### 10.5 Khả năng tiếp cận

Skip link, focus hiển thị rõ, `aria-live` cho kết quả request, toast và trạng thái kết nối, dialog dựng trên `<dialog>` gốc (bẫy focus, Esc, trả focus), tabs/segmented control/menu/command palette theo mẫu WAI-ARIA với điều khiển bằng phím mũi tên, form nối label–hint–lỗi bằng `aria-describedby`, biểu đồ có bảng số liệu tương đương và màu biểu đồ đã kiểm tra cho người mù màu, mọi hành động trong cảnh 3D đều có nút tương đương.

---

## 11. Chiến lược kiểm thử

| Tầng                  | Công cụ                          | Phạm vi                                                                                                                                                                                                                                                        |
| --------------------- | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Backend unit          | Vitest                           | Env (kể cả production), AppError, format, `validate`, bộ ghi metrics, phân loại địa chỉ private (SSRF)                                                                                                                                                         |
| Backend integration   | Vitest + Supertest + SQLite thật | Mọi endpoint: thành công, không tồn tại (404), thiếu/sai dữ liệu (400), sai/hết hạn token (401), phân quyền (403), trùng lặp (409), khoá tài khoản (429), xoay vòng và dùng lại refresh token, tài nguyên của người khác, workspace khởi tạo cho tài khoản mới |
| API Tester            | Server HTTP thật trong test      | Method/params/headers/auth/body, redirect, gzip, nhị phân, timeout, lỗi kết nối, giới hạn kích thước, rate limit, chặn loopback/metadata/private/IPv6/IPv4-mapped và kiểm tra lại sau redirect                                                                 |
| Frontend unit         | Vitest                           | Parser và xuất cURL, biến `{{…}}`, đồng bộ URL ↔ params, draft store, OpenAPI → request, xử lý response, ánh xạ lỗi form, chống open redirect, chấm điểm command palette, phân trang                                                                           |
| End-to-end (thủ công) | Chrome headless                  | Đăng nhập, gửi request, lưu token, import cURL, các màn hình chính ở dark/light, desktop/điện thoại, bản production dưới CSP                                                                                                                                   |

Hiện có **140 test backend** và **41 test frontend**. Test backend chạy tuần tự trên một file SQLite riêng dựng lại từ migration mỗi lần chạy; môi trường test khép kín, không cần secret.

---

## 12. Lộ trình 8 giai đoạn

| Phase                     | Nội dung đã hoàn thành                                                                                                                                                             |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1. Foundation** ✅      | Monorepo, kiến trúc, schema + migration + seed, backend skeleton bảo mật, frontend shell + theme + lõi 3D, CI                                                                      |
| **2. 3D environment** ✅  | Landing full-bleed: particles, bloom, depth of field, đổ bóng, camera theo chuột và cuộn, parallax, Lenis, custom cursor, intro loader                                             |
| **3. Interface kit** ✅   | Bộ component (input, select, switch, dialog, confirm, tabs, menu, pagination, key-value/code editor), toast, skeleton, command palette, phím tắt, settings, profile, notifications |
| **4. REST API** ✅        | Auth, users, products CRUD + PATCH, validation, phân trang/lọc/sắp xếp, phân quyền                                                                                                 |
| **5. Data layer** ✅      | Collections, saved requests, environments, history (giới hạn 500 mục/người), thống kê dashboard, workspace khởi tạo                                                                |
| **6. API tester** ✅      | Composer, response viewer, collections, environments, history, import/export cURL, tài liệu API từ OpenAPI, dashboard                                                              |
| **7. Auth & security** ✅ | Refresh rotation + phát hiện dùng lại, logout mọi thiết bị, khoá tài khoản, rate limit theo tầng, SSRF guard, CSP                                                                  |
| **8. Quality** ✅         | 181 test, kiểm tra màu biểu đồ cho người mù màu, kiểm tra thủ công trên desktop/điện thoại, production dưới CSP, tài liệu                                                          |

### Checklist yêu cầu

- [x] Mọi nút đều hoạt động; mọi endpoint chạy với database thật, không dữ liệu giả
- [x] API Tester gửi HTTP thật (GET/POST/PUT/PATCH/DELETE…), headers, query params, Bearer/Basic, body JSON/raw
- [x] Response: status, thời gian, kích thước, headers, JSON pretty, raw, lỗi; Send, Reset (New request), Save, History, Collections, Import cURL, Copy/Export, Environment variables, API Documentation
- [x] Dashboard: tổng/thành công/thất bại, thời gian trung bình, biểu đồ theo thời gian, phân bố status code, hoạt động gần đây
- [x] Dark/light, auth, đăng nhập/đăng ký, profile, settings, thông báo, sidebar responsive, tìm kiếm & lọc, toast, xử lý lỗi, skeleton, phím tắt
- [x] Lazy loading, code splitting, 3D tối ưu, debounce, validate input, rate limit, CORS, JWT an toàn, băm mật khẩu, biến môi trường, xử lý lỗi
- [x] Không lưu API secret hoặc private key ở frontend
- [x] Hướng dẫn cài đặt, `.env.example`, README

---

## 13. Ghi chú vận hành

- **Prisma CLI** tải schema engine từ `binaries.prisma.sh` ở lần `generate`/`migrate` đầu tiên — cần Internet. Lúc chạy ứng dụng không cần engine (client TypeScript + driver adapter).
- **better-sqlite3** là native module: các bản Node LTS có binary dựng sẵn. Nếu dùng phiên bản Node khác, máy cần công cụ build C++ (trên Windows: "Desktop development with C++" của Visual Studio Build Tools).
- Console có cảnh báo `THREE.Clock … deprecated` — đến từ React Three Fiber 9.8, không phải code dự án; sẽ hết khi thư viện cập nhật.
