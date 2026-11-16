import { config } from "dotenv";

config({ path: [".env.local", ".env"], quiet: true });
import { defineConfig } from "drizzle-kit";

/** Migration dùng chuỗi Direct (không qua pooler); không có thì dùng DATABASE_URL. */
function databaseUrl(): string {
  const name = process.env.DATABASE_URL_UNPOOLED?.trim() ? "DATABASE_URL_UNPOOLED" : "DATABASE_URL";
  const raw = process.env[name]?.trim() ?? "";
  const fail = (why: string): never => {
    throw new Error(`[drizzle] ${name} ${why}. Kiểm tra Environment Variables trên Vercel (đúng môi trường Production/Preview) rồi Redeploy.`);
  };
  if (!raw) fail("chưa được đặt hoặc đang trống");
  if (/^psql\s/i.test(raw)) fail("đang chứa cả lệnh psql – chỉ dán phần postgresql://…");
  if (/^["']|["']$/.test(raw)) fail("có dấu nháy ở đầu/cuối – bỏ dấu nháy đi");
  if (!/^postgres(ql)?:\/\//i.test(raw)) fail("phải bắt đầu bằng postgresql://");
  try {
    new URL(raw);
  } catch {
    fail("không phải URL hợp lệ (mật khẩu có ký tự đặc biệt thì phải mã hoá %xx)");
  }
  return raw;
}

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: databaseUrl() },
});
