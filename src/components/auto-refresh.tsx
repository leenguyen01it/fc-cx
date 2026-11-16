"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Cập nhật dữ liệu khi người dùng QUAY LẠI trang (VD vừa chuyển khoản xong trong app ngân hàng),
 * không tự gọi server theo chu kỳ. Tải lại trang thì đương nhiên có dữ liệu mới.
 */
export function AutoRefresh() {
  const router = useRouter();
  useEffect(() => {
    let last = Date.now();
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - last < 2000) return; // tránh gọi trùng khi nhiều sự kiện cùng lúc
      last = Date.now();
      router.refresh();
    };
    // Quay lại tab / app; Safari khôi phục trang từ bộ nhớ đệm khi bấm "quay lại"
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("pageshow", refresh);
    return () => {
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("pageshow", refresh);
    };
  }, [router]);
  return null;
}
