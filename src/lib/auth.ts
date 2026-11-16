import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const ADMIN_COOKIE = "tb_admin";
/** Trình duyệt giới hạn cookie tối đa ~400 ngày; proxy.ts tự gia hạn mỗi lần vào admin. */
export const ADMIN_COOKIE_MAX_AGE = 60 * 60 * 24 * 400;

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) throw new Error("Thiếu SESSION_SECRET (tối thiểu 16 ký tự)");
  return s;
}

function sign(value: string) {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

function safeEqual(a: string, b: string) {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

/**
 * Token đăng nhập không hết hạn, gắn với mật khẩu hiện tại:
 * đổi ADMIN_PASSWORD → mọi máy đang đăng nhập tự bị đăng xuất.
 */
function sessionToken() {
  const pw = createHash("sha256").update(process.env.ADMIN_PASSWORD ?? "").digest("base64url");
  return "v1." + sign(`admin:${pw}`);
}

export const adminCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: ADMIN_COOKIE_MAX_AGE,
};

export function checkPassword(input: string): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  return safeEqual(sign(input), sign(expected));
}

export async function createSession() {
  (await cookies()).set(ADMIN_COOKIE, sessionToken(), adminCookieOptions);
}

export async function destroySession() {
  (await cookies()).delete(ADMIN_COOKIE);
}

export function isValidToken(raw: string | undefined): boolean {
  if (!raw || !process.env.ADMIN_PASSWORD) return false;
  return safeEqual(raw, sessionToken());
}

export async function isAdmin(): Promise<boolean> {
  return isValidToken((await cookies()).get(ADMIN_COOKIE)?.value);
}

/** Gọi đầu mỗi trang admin và mỗi server action ghi dữ liệu. */
export async function requireAdmin() {
  if (!(await isAdmin())) redirect("/admin/login");
}
