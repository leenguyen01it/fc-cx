"use client";

import { useSyncExternalStore } from "react";

/** "Bạn là ai" – lưu trên máy người dùng (không cần đăng nhập). */
const KEY = "ttb:me";
const EVENT = "ttb:me-change";

function read(): number | null {
  try {
    const v = Number(localStorage.getItem(KEY));
    return Number.isInteger(v) && v > 0 ? v : null;
  } catch {
    return null;
  }
}

function subscribe(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener(EVENT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(EVENT, cb);
  };
}

export function setMe(id: number | null) {
  try {
    if (id) localStorage.setItem(KEY, String(id));
    else localStorage.removeItem(KEY);
  } catch {}
  window.dispatchEvent(new Event(EVENT));
}

/** null khi chưa chọn (hoặc đang render phía server). */
export function useMe(): number | null {
  return useSyncExternalStore(subscribe, read, () => null);
}
