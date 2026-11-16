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

/** Nội dung chuyển khoản in trên thẻ QR: "CX HUNG CK da bong". */
export function transferContent(prefix: string, code: string, suffix = ""): string {
  return [prefix.trim().toUpperCase(), code, suffix.trim()].filter(Boolean).join(" ");
}
