/** Bỏ dấu tiếng Việt, giữ chữ cái thường/hoa. */
export function stripDiacritics(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
}

/** Chuẩn hoá về dạng "CX HUNG FT123": không dấu, in hoa, chỉ chữ số và khoảng trắng. */
export function normalizeContent(s: string): string {
  return stripDiacritics(s)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

/** Độ dài tối đa mã thành viên: "CX " + mã + " CK da bong" vừa 25 ký tự (giới hạn nội dung QR). */
export const MAX_CODE_LEN = 11;

/** Mã thành viên hợp lệ: chữ in hoa không dấu và số, các chữ cách nhau 1 dấu cách ("QUANG NGOC"). */
export function sanitizeCode(s: string): string {
  return stripDiacritics(s)
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_CODE_LEN)
    .trim();
}

/**
 * Gợi ý mã từ tên đệm + tên để tránh trùng tên phổ biến:
 *   "Trần Quang Ngọc" → "QUANG NGOC", "Lê Bảo Ngọc" → "BAO NGOC"
 * Trùng thì thêm chữ đầu của họ: "Phan Văn Hùng" → "P VAN HUNG"; vẫn trùng mới thêm số.
 */
export function suggestCode(name: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  const words = stripDiacritics(name)
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const fits = (c: string) => c.length >= 2 && c.length <= MAX_CODE_LEN;
  const last = words[words.length - 1] ?? "TV";
  const two = words.length >= 2 ? `${words[words.length - 2]} ${last}` : last;
  const base = fits(two) ? two : last.slice(0, MAX_CODE_LEN);

  const candidates = [base];
  if (words.length >= 3) candidates.push(`${words.slice(0, -2).map((w) => w[0]).join("")} ${base}`);
  for (const c of candidates) if (fits(c) && !used.has(c)) return c;
  for (let i = 2; ; i++) {
    const c = `${base.slice(0, MAX_CODE_LEN - String(i).length - 1).trim()} ${i}`;
    if (!used.has(c)) return c;
  }
}

export function formatVnd(n: number): string {
  return new Intl.NumberFormat("vi-VN").format(Math.round(n)) + "đ";
}

/** 172000 → "172k", 1250000 → "1.250k". */
export function formatK(n: number): string {
  const k = n / 1000;
  const s = Number.isInteger(k)
    ? new Intl.NumberFormat("vi-VN").format(k)
    : new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 }).format(k);
  return `${s}k`;
}

const WEEKDAYS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

/** "2026-11-15" → { short: "15/11", full: "15/11/2026", weekday: "CN" } – không lệch múi giờ. */
export function formatDate(d: string) {
  const [y, m, day] = d.split("-").map(Number);
  const wd = new Date(Date.UTC(y, m - 1, day)).getUTCDay();
  const dd = String(day).padStart(2, "0");
  const mm = String(m).padStart(2, "0");
  return { short: `${dd}/${mm}`, full: `${dd}/${mm}/${y}`, weekday: WEEKDAYS[wd] };
}

export function formatTime(d: Date): string {
  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(d);
}

export function formatDateTime(d: Date): string {
  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(d);
}

/** Ngày hôm nay theo giờ Việt Nam, dạng YYYY-MM-DD. */
export function todayVN(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date());
}

/** Đường dẫn trang cá nhân: "QUANG NGOC" → "/the/QUANG-NGOC". */
export const memberPath = (code: string) => `/the/${code.replace(/ /g, "-")}`;
/** Ngược lại: "QUANG-NGOC" (hoặc "QUANG%20NGOC") → "QUANG NGOC". */
export const codeFromPath = (slug: string) => decodeURIComponent(slug).replace(/-/g, " ").toUpperCase();
