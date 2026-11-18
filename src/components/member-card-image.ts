"use client";

import { buildVietQr } from "@/lib/vietqr";
import { formatVnd, stripDiacritics } from "@/lib/text";
import { renderVietQrPanel, saveCanvasImage } from "./qr-image";

export interface MemberCardInput {
  teamName: string;
  name: string;
  /** Nội dung cố định, VD "CX HUNG CK da bong". */
  content: string;
  bankBin: string;
  bankName: string;
  accountNo: string;
  accountName: string;
  /** Có số tiền → QR của một lần trả: quét từ ảnh là app điền đủ STK, số tiền, nội dung. */
  amount?: number;
}

/**
 * Thẻ QR của thành viên. Không có số tiền: thẻ cố định dùng cho mọi trận (tự nhập số tiền).
 * Có số tiền: QR của đúng khoản đang trả.
 */
export async function renderMemberCard(p: MemberCardInput): Promise<HTMLCanvasElement> {
  const amount = p.amount && p.amount > 0 ? Math.round(p.amount) : undefined;
  const payload = buildVietQr({ bankBin: p.bankBin, accountNo: p.accountNo, content: p.content, amount });
  const panel = await renderVietQrPanel({
    payload,
    bankBin: p.bankBin,
    bankName: p.bankName,
    accountNo: p.accountNo,
    accountName: p.accountName,
    content: p.content,
    rounded: true,
  });
  const W = 720;
  const top = amount ? 250 : 180;
  const H = top + panel.height + 50;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d")!;
  const font = getComputedStyle(document.body).fontFamily;
  const grad = g.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, "#ea580c");
  grad.addColorStop(1, "#f97316");
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);

  g.fillStyle = "#ffffff";
  g.textAlign = "center";
  g.font = `800 36px ${font}`;
  g.fillText(p.teamName.toUpperCase(), W / 2, 76);
  g.font = `800 50px ${font}`;
  g.fillText(p.name, W / 2, 140);
  if (amount) {
    g.font = `900 56px ${font}`;
    g.fillText(formatVnd(amount), W / 2, 215);
  }

  g.drawImage(panel, (W - panel.width) / 2, top);

  return c;
}

export async function saveMemberCard(p: MemberCardInput) {
  const canvas = await renderMemberCard(p);
  const slug = stripDiacritics(p.name).toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return saveCanvasImage(canvas, p.amount ? `qr-${slug}-${Math.round(p.amount)}.png` : `the-qr-${slug}.png`);
}
