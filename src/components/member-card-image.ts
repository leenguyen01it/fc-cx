"use client";

import { buildVietQr } from "@/lib/vietqr";
import { stripDiacritics } from "@/lib/text";
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
}

/**
 * Thẻ QR cố định của thành viên – KHÔNG kèm số tiền, dùng cho mọi trận.
 * Mỗi lần trả chỉ cần mở ảnh này trong app ngân hàng và nhập số tiền.
 */
export async function renderMemberCard(p: MemberCardInput): Promise<HTMLCanvasElement> {
  const payload = buildVietQr({ bankBin: p.bankBin, accountNo: p.accountNo, content: p.content });
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
  const H = 180 + panel.height + 50;
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

  g.drawImage(panel, (W - panel.width) / 2, 180);

  return c;
}

export async function saveMemberCard(p: MemberCardInput) {
  const canvas = await renderMemberCard(p);
  return saveCanvasImage(canvas, `the-qr-${stripDiacritics(p.name).toLowerCase().replace(/[^a-z0-9]+/g, "-")}.png`);
}
