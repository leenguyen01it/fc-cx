import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE, adminCookieOptions, isValidToken } from "@/lib/auth";

/** Mỗi lần admin mở trang quản trị: gia hạn cookie đăng nhập thêm 400 ngày. */
export function proxy(request: NextRequest) {
  const res = NextResponse.next();
  const token = request.cookies.get(ADMIN_COOKIE)?.value;
  if (token && isValidToken(token)) res.cookies.set(ADMIN_COOKIE, token, adminCookieOptions);
  return res;
}

export const config = {
  matcher: ["/admin/:path*"],
};
