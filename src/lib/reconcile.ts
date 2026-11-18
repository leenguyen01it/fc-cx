import { normalizeContent } from "./text";

/**
 * Tìm thành viên từ nội dung chuyển khoản.
 * Ngân hàng hay chèn thêm chữ: "MBVCB.123.CX HUNG.CT tu 0123..." hoặc bỏ khoảng trắng "CXHUNG".
 */
export interface ParseResult {
  /** Nội dung có mã đội (TB ...). */
  hasPrefix: boolean;
  code: string | null;
}

export function parseTransferContent(raw: string, prefix: string, codes: string[]): ParseResult {
  const P = normalizeContent(prefix).replace(/\s/g, "");
  const tokens = normalizeContent(raw).split(" ").filter(Boolean);
  if (!P) return { hasPrefix: false, code: null };

  // Mã nhiều chữ / dài hơn được thử trước: "P VAN HUNG" trước "VAN HUNG", "HUNGA" trước "HUNG"
  const known = [...new Set(codes)]
    .map((c) => ({ code: c, parts: normalizeContent(c).split(" ").filter(Boolean) }))
    .filter((c) => c.parts.length)
    .sort((a, b) => b.parts.length - a.parts.length || b.parts.join("").length - a.parts.join("").length);

  const seqAt = (i: number, parts: string[]) => parts.every((p, k) => tokens[i + k] === p);

  let hasPrefix = false;
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    const isPrefix = t === P;
    const glued = t.startsWith(P) && t.length > P.length; // "CXQUANG", "123CX…" xử lý ở dưới
    if (isPrefix) hasPrefix = true;
    for (const { code, parts } of known) {
      const compact = parts.join("");
      // 1) "CX QUANG NGOC" – đúng từng chữ
      if (isPrefix && seqAt(i + 1, parts)) return { hasPrefix: true, code };
      // 2) ngân hàng gộp chữ: "CX QUANGNGOC"
      if (isPrefix && tokens[i + 1] === compact) return { hasPrefix: true, code };
      // 3) dính mã đội: "CXQUANG NGOC" hoặc "CXQUANGNGOC"
      if (glued && t.slice(P.length) === parts[0] && seqAt(i + 1, parts.slice(1))) return { hasPrefix: true, code };
      if (glued && t.slice(P.length) === compact) return { hasPrefix: true, code };
      // 4) bị ghép chữ phía trước: "123CXQUANGNGOC" – mã phải nằm ở CUỐI từ
      if (t.endsWith(P + compact) && t.length > (P + compact).length) return { hasPrefix: true, code };
      if (t.endsWith(P + parts[0]) && parts.length > 1 && seqAt(i + 1, parts.slice(1))) return { hasPrefix: true, code };
    }
    // "CXTUAN" sai tên: vẫn coi là tiền bóng để admin xác nhận (an toàn hơn bỏ qua)
    if (glued && /^[A-Z][A-Z0-9]{1,11}$/.test(t.slice(P.length))) hasPrefix = true;
  }
  return { hasPrefix, code: null };
}

/**
 * Nội dung mặc định của ngân hàng thường có họ tên người chuyển ("NGUYEN VAN HUNG chuyen tien")
 * → tìm thành viên có họ tên đầy đủ (không dấu, ≥ 2 chữ) nằm liền trong nội dung.
 * Tên ngắn nằm trong tên dài hơn cùng chỗ thì bỏ ("VAN HUNG" trong "NGUYEN VAN HUNG").
 * Trả về id chỉ khi đúng 1 người khớp; nhiều người / không ai → null.
 */
export function matchSenderName(raw: string, people: { id: number; name: string }[]): number | null {
  const tokens = normalizeContent(raw).split(" ").filter(Boolean);
  const hits: { id: number; start: number; end: number }[] = [];
  for (const p of people) {
    const parts = normalizeContent(p.name).split(" ").filter(Boolean);
    if (parts.length < 2) continue;
    const compact = parts.join("");
    for (let i = 0; i < tokens.length; i++) {
      if (parts.every((w, k) => tokens[i + k] === w)) hits.push({ id: p.id, start: i, end: i + parts.length });
      else if (tokens[i] === compact) hits.push({ id: p.id, start: i, end: i + 1 });
    }
  }
  const kept = hits.filter(
    (h) => !hits.some((o) => o !== h && o.start <= h.start && o.end >= h.end && o.end - o.start > h.end - h.start),
  );
  const ids = new Set(kept.map((h) => h.id));
  return ids.size === 1 ? [...ids][0] : null;
}

/**
 * Tên dùng để nhận người chuyển: họ tên chủ tài khoản nếu có;
 * không có thì dùng tên hiển thị khi đủ 3 chữ trở lên (tên 2 chữ như "Văn Hùng" dễ nằm trong tên người khác).
 */
export function senderNameOf(m: { name: string; bankHolder: string }): string {
  if (m.bankHolder.trim()) return m.bankHolder;
  return m.name.trim().split(/\s+/).length >= 3 ? m.name : "";
}

/** Nội dung chuyển khoản in trên thẻ QR: "CX HUNG CK da bong". */
export function transferContent(prefix: string, code: string, suffix = ""): string {
  return [prefix.trim().toUpperCase(), code, suffix.trim()].filter(Boolean).join(" ");
}
