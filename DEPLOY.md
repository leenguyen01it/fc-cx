# Deploy lên Vercel + Neon

Tài liệu từng bước để đưa app lên mạng: database Postgres trên **Neon**, web chạy trên **Vercel**, tự đối soát tiền qua **SePay**.

Tổng thời gian khoảng 30 phút. Cả Neon và Vercel đều có gói miễn phí, đủ dùng cho một đội bóng.

---

## 0. Tổng quan

```
Điện thoại anh em ──► Vercel (Next.js, region Singapore) ──► Neon Postgres (Singapore)
                              ▲
SePay (tiền vào tài khoản) ───┘  POST /api/webhook/sepay
```

| Biến môi trường | Lấy ở đâu | Dùng để |
|---|---|---|
| `DATABASE_URL` | Neon, chuỗi **Pooled** (host có `-pooler`) | App đọc/ghi dữ liệu |
| `DATABASE_URL_UNPOOLED` | Neon, chuỗi **Direct** (host không có `-pooler`) | Chạy migration lúc build |
| `ADMIN_PASSWORD` | Tự đặt | Đăng nhập `/admin` |
| `SESSION_SECRET` | `openssl rand -base64 32` | Ký cookie đăng nhập |
| `WEBHOOK_API_KEY` | `openssl rand -hex 24` | SePay gọi webhook |
| `SITE_URL` *(tuỳ chọn)* | Domain chính thức, VD `https://cx.example.com` | Link trong tin nhắn Zalo. Không đặt thì lấy domain Vercel |

> Đổi `ADMIN_PASSWORD` hoặc `SESSION_SECRET` sẽ đăng xuất mọi phiên admin đang mở.

---

## 1. Kiểm tra trước khi deploy (trên máy)

```bash
npm install
npm test          # toàn bộ test phải qua
npm run lint
npm run build     # build thử bản production
```

Nếu đang chạy `npm run dev` thì build vào thư mục khác để không đụng nhau:

```bash
NEXT_DIST_DIR=.next-preview npm run build
```

### Migration

Thư mục `drizzle/` chỉ còn **một** migration `0000_init.sql`, tạo toàn bộ bảng. Các migration cũ (0000 → 0010) đã được gộp lại trước lần deploy đầu tiên. Database mới trên Neon chỉ cần chạy đúng file này.

> **Database local tạo trước khi gộp:** đã được đánh dấu là chạy rồi, nên `npm run db:migrate` vẫn chạy bình thường.
> Nếu có máy khác dùng database cũ và `db:migrate` báo lỗi *relation already exists*, chạy một lần lệnh sau (không đụng dữ liệu):
>
> ```sql
> INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
> VALUES ('faf99b8dfdefd938ec0a829db8548dcd64ab0f02619a600c9c98fcdd17955a0f', 1794793940440);
> ```
>
> Hoặc xoá hẳn database local rồi tạo lại: `npm run db:migrate && npm run db:seed`.

---

## 2. Đưa code lên GitHub

Thư mục dự án chưa phải git repo. Tạo repo **private**, vì code có tên thành viên trong dữ liệu mẫu:

```bash
git init -b main
git add .
git status        # kiểm tra: KHÔNG được có .env.local, chỉ có .env.example
git commit -m "Thu tiền bóng – bản đầu"

# Dùng GitHub CLI (hoặc tạo repo trên github.com rồi git remote add origin …)
gh repo create thu-tien-bong --private --source . --push
```

`.gitignore` đã chặn sẵn `.env*` (trừ `.env.example`), `node_modules`, `.next`, `.idea`.

---

## 3. Tạo database trên Neon

1. Đăng nhập **https://console.neon.tech** và bấm **New Project**.
   - **Project name**: `thu-tien-bong`
   - **Postgres version**: 17
   - **Region**: **AWS Asia Pacific (Singapore)**. Gần Việt Nam nhất, và phải cùng vùng với Vercel ở bước 4.
   - **Database name**: để mặc định `neondb`.
2. Vào **Dashboard → Connect** để lấy 2 chuỗi kết nối:
   - Bật **Connection pooling** rồi copy chuỗi đó → dùng làm `DATABASE_URL`. Host có dạng `ep-xxx-pooler.ap-southeast-1.aws.neon.tech`.
   - Tắt **Connection pooling** rồi copy lần nữa → dùng làm `DATABASE_URL_UNPOOLED`. Host không có `-pooler`.
   - Cả hai đều phải có `?sslmode=require` ở cuối.
3. *(Khuyên dùng)* Tạo nhánh database cho môi trường thử: **Branches → Create branch**, đặt tên `preview`, nhánh cha là `main`. Lấy 2 chuỗi kết nối của nhánh này như trên. Lý do xem ở mục 4.4.

> Code đã cấu hình sẵn cho Neon: `src/db/index.ts` tắt prepared statements (`prepare: false`), vì chuỗi pooled đi qua PgBouncer.
> Migration luôn chạy bằng chuỗi Direct (`drizzle.config.ts` ưu tiên `DATABASE_URL_UNPOOLED`).

**Cách khác:** trong Vercel vào **Storage → Create Database → Neon** để tạo database ngay trong Vercel. Vercel sẽ tự điền `DATABASE_URL` và `DATABASE_URL_UNPOOLED`, và có thể tự tạo nhánh database cho mỗi bản preview. Khi đó bỏ qua bước 3 và phần biến database ở bước 4.3, nhưng nhớ chọn region **Singapore**.

---

## 4. Tạo project trên Vercel

### 4.1 Import

1. Vào **https://vercel.com/new**, kết nối GitHub và chọn repo `thu-tien-bong`.
2. **Framework Preset**: Next.js (tự nhận).
3. **Build Command / Install Command / Output**: để mặc định.
   Vercel tự dùng script `vercel-build` trong `package.json`:
   ```
   drizzle-kit migrate && next build
   ```
   Tức là **mỗi lần deploy sẽ tự chạy migration trước rồi mới build**. Nếu migration lỗi thì deploy dừng và bản đang chạy giữ nguyên.

### 4.2 Region của server

Mặc định Vercel chạy server ở Mỹ (`iad1`). Database ở Singapore thì mỗi truy vấn phải đi vòng nửa vòng trái đất, trang sẽ chậm thấy rõ.

Vào **Project → Settings → Functions → Function Region** và chọn **Singapore (sin1)**, rồi deploy lại.

### 4.3 Biến môi trường

Vào **Settings → Environment Variables**. Với mỗi biến, chọn môi trường áp dụng:

| Biến | Production | Preview |
|---|---|---|
| `DATABASE_URL` | Pooled của nhánh `main` | Pooled của nhánh `preview` |
| `DATABASE_URL_UNPOOLED` | Direct của nhánh `main` | Direct của nhánh `preview` |
| `ADMIN_PASSWORD` | ✔ (bật **Sensitive**) | ✔ |
| `SESSION_SECRET` | ✔ (bật **Sensitive**) | ✔ (nên dùng giá trị khác) |
| `WEBHOOK_API_KEY` | ✔ (bật **Sensitive**) | ✔ |
| `SITE_URL` | nếu có domain riêng | không cần |

Tạo chuỗi ngẫu nhiên:

```bash
openssl rand -base64 32   # SESSION_SECRET
openssl rand -hex 24      # WEBHOOK_API_KEY
```

> Sửa biến môi trường xong phải **Redeploy** thì mới có hiệu lực.

### 4.4 Vì sao Preview phải dùng nhánh database riêng

Mỗi lần push lên nhánh git khác `main`, Vercel tạo một bản **Preview** và cũng chạy `drizzle-kit migrate`. Nếu Preview dùng chung database production, một migration đang thử nghiệm sẽ chạy thẳng vào dữ liệu thật.

Nếu không muốn có Preview: vào **Settings → Git**, tắt deploy tự động cho các nhánh khác `main` (*Ignored Build Step*, hoặc chỉ deploy production).

### 4.5 Deploy

Bấm **Deploy**. Trong log build phải thấy:

```
[✓] migrations applied successfully!
✓ Compiled successfully
```

Mở domain `https://<tên-project>.vercel.app` để kiểm tra.

---

## 5. Thiết lập lần đầu trên app

1. Vào `https://<domain>/admin` và đăng nhập bằng `ADMIN_PASSWORD`.
2. Vào **Cài đặt** và nhập:
   - Tên đội, mã đội (đứng đầu nội dung chuyển khoản, VD `CX`), chữ thêm sau mã (VD `CK da bong`)
   - Ngân hàng, **số tài khoản riêng của đội**, tên chủ tài khoản
   - Tên 2 đội nội bộ, sân và giờ mặc định
3. Vào **Thành viên** và thêm từng người. Mã thành viên (VD `HUNG`) chính là phần nội dung chuyển khoản.
4. Gửi mỗi người link `https://<domain>/the/<MÃ>` để họ lưu thẻ QR cá nhân.
5. Gửi link chung `https://<domain>` vào nhóm Zalo.

> **Không chạy `npm run db:seed` vào Neon.** Script này xoá sạch dữ liệu, và mặc định đã chặn khi thấy chuỗi kết nối Neon.

### (Tuỳ chọn) Chuyển dữ liệu từ máy lên Neon

Nếu đã nhập thật thành viên, trận… ở database local và muốn mang lên, làm **ngay sau lần deploy đầu, trước khi ai dùng app**:

```bash
pg_dump --data-only --no-owner --no-privileges -n public "$LOCAL_DATABASE_URL" \
  | psql "<chuỗi Direct của Neon nhánh main>"
```

Lệnh trên chỉ chép dữ liệu (bảng đã được migration tạo sẵn), và chép luôn bộ đếm id.

---

## 6. Tự đối soát chuyển khoản (SePay)

1. Đăng ký **https://sepay.vn** và liên kết **tài khoản ngân hàng riêng của đội**.
2. Vào **Tích hợp Webhooks → Thêm webhooks**:
   - **Sự kiện**: Có tiền vào
   - **URL**: `https://<domain>/api/webhook/sepay`
   - **Kiểu chứng thực**: API Key, giá trị **giống hệt** `WEBHOOK_API_KEY` trên Vercel
   - **Bỏ qua nếu nội dung không có code thanh toán**: **Không**. App tự nhận diện mã thành viên; giao dịch không nhận ra sẽ nằm ở mục chờ admin xác nhận.
3. Thử: chuyển 2.000đ với nội dung `CX <MÃ> CK da bong`, rồi xem **Admin → Giao dịch** có dòng mới.

Nếu SePay báo lỗi 401 thì API Key không khớp. Sửa ở một trong hai bên, nếu sửa trên Vercel thì phải Redeploy.

---

## 7. Domain riêng (tuỳ chọn)

1. Vào **Vercel → Settings → Domains → Add**, nhập VD `cx.example.com`.
2. Ở nhà cung cấp domain, thêm bản ghi `CNAME cx → cname.vercel-dns.com`. Domain gốc thì làm theo bản ghi `A` mà Vercel chỉ dẫn.
3. Đặt `SITE_URL=https://cx.example.com` rồi Redeploy.
4. Cập nhật URL webhook bên SePay sang domain mới.

---

## 8. Cập nhật app về sau

### Chỉ sửa code

```bash
npm test && npm run lint
git add . && git commit -m "…" && git push
```

Vercel tự build và deploy sau khoảng 1–2 phút.

### Có đổi cấu trúc database (`src/db/schema.ts`)

```bash
npm run db:generate      # sinh drizzle/00xx_*.sql
# đọc lại file SQL vừa sinh – đặc biệt các lệnh DROP / đổi kiểu cột
npm run db:migrate       # thử trên database local
npm test
git add . && git commit -m "…" && git push   # Vercel tự migrate Neon rồi build
```

Nguyên tắc để không mất dữ liệu thật:

- **Không sửa hay xoá** migration đã deploy. Muốn đổi gì thì tạo migration mới.
- **Không gộp migration nữa** sau khi Neon đã chạy. Lần gộp vừa rồi chỉ an toàn vì Neon còn trống.
- Thêm cột `NOT NULL` thì phải có `DEFAULT`, nếu không migration sẽ lỗi vì bảng đã có dữ liệu.
- Đổi tên hoặc xoá cột: tạo **nhánh Neon** từ `main` (bước 9) để thử trước.

---

## 9. Sao lưu & khôi phục

- **Neon tự lưu lịch sử** (point-in-time restore). Thời gian giữ tuỳ gói, xem ở **Settings → Storage / History retention**. Muốn khôi phục thì vào **Branches → Restore**, chọn thời điểm.
- **Thử thao tác nguy hiểm**: tạo nhánh mới từ `main` (chỉ mất vài giây, không tốn dung lượng thêm cho đến khi dữ liệu khác đi), trỏ app local vào nhánh đó để thử.
- **Sao lưu thủ công** (nên làm định kỳ, VD cuối tháng):

  ```bash
  pg_dump --no-owner --no-privileges "<chuỗi Direct>" > backup-$(date +%F).sql
  ```

  Khôi phục vào database trống: `psql "<chuỗi Direct mới>" < backup-YYYY-MM-DD.sql`.

> `pg_dump` trên máy phải cùng hoặc mới hơn bản Postgres của Neon (17). Nếu báo *server version mismatch* thì chạy bằng Docker:
> `docker run --rm postgres:17-alpine pg_dump "<chuỗi Direct>" > backup.sql`

---

## 10. Xử lý sự cố

| Triệu chứng | Nguyên nhân thường gặp | Cách xử lý |
|---|---|---|
| Build lỗi `TypeError: Invalid URL` hoặc `[drizzle] DATABASE_URL… ` | Biến database thiếu ở môi trường đang deploy, để trống, dán cả lệnh `psql '…'`, hoặc có dấu nháy | Chỉ dán phần `postgresql://…?sslmode=require`, tick đúng môi trường (Production/Preview), Redeploy |
| Build lỗi ở `drizzle-kit migrate`, *password authentication failed* | Sai hoặc thiếu `DATABASE_URL_UNPOOLED` | Copy lại chuỗi Direct từ Neon, Redeploy |
| Build lỗi *relation "…" already exists* | Database đã có bảng nhưng chưa có bảng `drizzle.__drizzle_migrations` (VD tạo bảng bằng tay) | Dùng database/nhánh Neon trống, hoặc chèn dòng đánh dấu như ở mục 1 |
| Trang báo lỗi, log có *prepared statement … does not exist* | `DATABASE_URL` dùng chuỗi pooled nhưng code bị đổi `prepare` | Giữ `prepare: false` trong `src/db/index.ts` |
| Lần mở đầu sau một lúc lâu chậm 1–2 giây | Neon gói free tự ngủ khi không dùng (~5 phút) | Bình thường. Lần sau sẽ nhanh |
| Mọi trang đều chậm | Server Vercel và Neon khác vùng | Đặt Function Region = `sin1` (mục 4.2) |
| Không đăng nhập được admin | Sai `ADMIN_PASSWORD` hoặc chưa Redeploy sau khi sửa | Kiểm tra biến, Redeploy |
| SePay không tự đánh dấu đã trả | Sai URL/API Key, hoặc nội dung chuyển khoản không có mã | Xem **SePay → Nhật ký webhook** và **Admin → Giao dịch** (mục chờ xác nhận) |
| Link trong tin nhắn Zalo là `*.vercel.app` dù đã có domain | Chưa đặt `SITE_URL` | Đặt `SITE_URL`, Redeploy |

Xem log lúc chạy ở **Vercel → Project → Logs**, lọc theo `/api/webhook/sepay` hoặc theo mã lỗi 500.

---

## Checklist nhanh

- [ ] `npm test`, `npm run lint`, `npm run build` đều qua
- [ ] Repo GitHub private, không có `.env.local`
- [ ] Neon project ở Singapore, có chuỗi Pooled + Direct (và nhánh `preview` nếu dùng Preview)
- [ ] Vercel: đủ 5 biến môi trường, Function Region `sin1`
- [ ] Log build có `migrations applied successfully`
- [ ] `/admin` → Cài đặt: ngân hàng, số tài khoản, mã đội
- [ ] Thêm thành viên, gửi link thẻ QR
- [ ] SePay webhook trỏ đúng URL + API Key, đã thử chuyển 2.000đ
