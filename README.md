# ⚽ FC CX – Thu tiền bóng

Web app chia tiền sân, tiền ăn và tiền kèo sau mỗi trận, rồi tự đối soát chuyển khoản.

- **Một link chung cho cả đội**: xem trận theo ngày, công nợ, thống kê. Không cần đăng nhập.
- **Điểm danh ngay trên link chung** (thay cho vote Zalo – Zalo không có API đọc bình chọn nhóm): admin tạo trận → mọi người tick *Đá* / *Ăn* → đá xong admin chỉ nhập tỷ số, tiền và số người mỗi đội rồi công bố → mỗi người **tự chọn đội khi vào đóng tiền** (nút ghi sẵn số tiền), hoặc chuyển đúng số tiền của đội mình là app tự xếp đội. Trận có thể **huỷ** (VD trời mưa) – vẫn hiện trên link với lý do.
- **Chia tiền linh hoạt**: tiền sân theo tỷ lệ thắng/thua (7/3, 5/5, …), tiền ăn chia cho người đi ăn, kèo do đội thua hoặc đội thắng chịu. Hòa thì mặc định 50/50. Khoản nào được ủng hộ thì trừ trước rồi mới chia: người ủng hộ là thành viên trong trận thì tiền ủng hộ cộng luôn vào số họ chuyển (hoặc chọn đưa tiền mặt), người ngoài thì chỉ ghi tên.
- **Thẻ QR cố định cho từng người** theo chuẩn VietQR (logo VietQR, napas 247, logo ngân hàng): nội dung ghi sẵn `CX <MÃ> CK da bong`, dùng cho mọi trận. Nội dung tối đa 25 ký tự theo chuẩn QR.
- **Mở app ngân hàng 1 chạm** (deeplink VietQR): MB, VietinBank, BIDV, OCB, ACB tự điền số tiền & nội dung; app khác mở lên và nội dung được copy sẵn để dán.
- **Mỗi trận chuyển đúng số tiền của trận đó**: khoản chuyển khớp số tiền trận nào thì gắn vào trận đó; chuyển sai số thì trừ trận cũ nhất còn nợ trước.
- **Webhook SePay**: tự đánh ✅ khi có tiền vào. Giao dịch không nhận ra người thì nằm ở mục chờ admin xác nhận.
- **Copy tin nhắn Zalo**: tổng kết trận và nhắc người chưa trả.

## Giao diện & kiểm tra dữ liệu

- **Mobile-first**: nút bấm cao ≥ 44px, chừa vùng tai thỏ/thanh home (safe-area), thanh điều hướng dưới cùng, sheet trượt từ dưới lên.
- **Bộ component** (`src/components/ui`): `Sheet` (modal), `Select` (danh sách chọn có tìm kiếm), `TextInput`, `MoneyInput`, `Switch`, `Segmented`, `Stepper`, `ConfirmButton`, `toast`.
- **Validate 2 lớp** (`src/lib/schemas.ts`, zod): cùng một schema chạy trên trình duyệt (báo lỗi ngay dưới từng ô) và trên server (server action, webhook). Dữ liệu client gửi lên luôn được kiểm tra lại.
- Icon: [lucide](https://lucide.dev).

## Chạy local

```bash
cp .env.example .env.local      # sửa DATABASE_URL, ADMIN_PASSWORD, SESSION_SECRET, WEBHOOK_API_KEY
# Postgres local (tuỳ chọn):
docker run -d --name ttb-pg --restart unless-stopped \
  -e POSTGRES_USER=ttb -e POSTGRES_PASSWORD=ttb_local -e POSTGRES_DB=thu_tien_bong \
  -v ttb-pgdata:/var/lib/postgresql/data -p 55432:5432 postgres:17-alpine
# → DATABASE_URL=postgres://ttb:ttb_local@localhost:55432/thu_tien_bong
npm install
npm run db:migrate
npm run db:seed                 # dữ liệu mẫu, XOÁ dữ liệu cũ, không chạy trên Neon thật
npm run dev                     # http://localhost:3000, admin ở /admin
npm test                        # test logic chia tiền, công nợ, VietQR, đối soát
```

## Deploy lên Vercel + Neon

Xem hướng dẫn chi tiết trong [DEPLOY.md](DEPLOY.md): Neon, Vercel, biến môi trường, SePay, domain, cập nhật, sao lưu, xử lý sự cố.

## Tự động đối soát (SePay)

1. Đăng ký **sepay.vn** và liên kết tài khoản ngân hàng riêng của đội.
2. Vào *Tích hợp Webhooks → Thêm*: sự kiện **Có tiền vào**, URL `https://<domain>/api/webhook/sepay`,
   chứng thực **API Key** với giá trị bằng `WEBHOOK_API_KEY`.
3. Xong. Mỗi giao dịch có nội dung `TB HUNG` sẽ tự trừ vào nợ của Hùng.

## Cấu trúc

| Đường dẫn | Nội dung |
|---|---|
| `src/lib/split.ts` | Quy tắc chia tiền (thuần TypeScript, có test) |
| `src/lib/ledger.ts` | Ví công nợ, phân bổ tiền theo FIFO |
| `src/lib/vietqr.ts` | Sinh mã VietQR (EMVCo) không cần API ngoài |
| `src/lib/reconcile.ts` | Nhận diện người chuyển từ nội dung chuyển khoản |
| `src/app/page.tsx` | Trang chung: Trận / Công nợ / Thống kê |
| `src/app/the/[code]` | Thẻ QR và lịch sử của từng người |
| `src/app/admin` | Quản trị: trận, thành viên, giao dịch, cài đặt |
| `src/app/api/webhook/sepay` | Nhận biến động số dư |
