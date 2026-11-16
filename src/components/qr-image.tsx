"use client";

import Image from "next/image";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { cx } from "./ui";

const imgCache = new Map<string, Promise<HTMLImageElement>>();
export function loadImage(src: string) {
  if (!imgCache.has(src)) {
    imgCache.set(
      src,
      new Promise((resolve, reject) => {
        const i = new window.Image();
        i.onload = () => resolve(i);
        i.onerror = reject;
        i.src = src;
      }),
    );
  }
  return imgCache.get(src)!;
}

export const bankLogo = (bin: string) => `/banks/${bin}.png`;

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.roundRect(x, y, w, h, r);
  g.fill();
}

/**
 * Vẽ mã VietQR có logo "V" ở giữa, giống mã của các ngân hàng.
 * Dùng mức sửa lỗi H (~30%) nên logo che giữa vẫn quét tốt.
 */
export async function renderVietQr(payload: string, size = 720): Promise<HTMLCanvasElement> {
  const qr = QRCode.create(payload, { errorCorrectionLevel: "H" });
  const n = qr.modules.size;
  const quiet = 2;
  const cell = size / (n + quiet * 2);
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d")!;
  g.fillStyle = "#ffffff";
  g.fillRect(0, 0, size, size);
  g.fillStyle = "#0f172a";
  for (let r = 0; r < n; r++) {
    for (let col = 0; col < n; col++) {
      if (!qr.modules.get(r, col)) continue;
      const x = Math.floor((col + quiet) * cell);
      const y = Math.floor((r + quiet) * cell);
      g.fillRect(x, y, Math.ceil(cell) + 0.5, Math.ceil(cell) + 0.5);
    }
  }
  // Logo VietQR ở giữa trên nền trắng bo góc
  const box = size * 0.2;
  const pad = box * 0.12;
  g.fillStyle = "#ffffff";
  roundRect(g, (size - box) / 2, (size - box) / 2, box, box, box * 0.22);
  const logo = await loadImage("/vietqr/v-mark.png");
  const inner = box - pad * 2;
  g.drawImage(logo, (size - inner) / 2, (size - inner) / 2, inner, inner);
  return c;
}

export function useVietQr(payload: string | null, size = 720) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    if (!payload) return;
    renderVietQr(payload, size)
      .then((c) => alive && setUrl(c.toDataURL("image/png")))
      .catch(() => {
        // Thiếu ảnh logo → vẫn hiện QR trơn
        QRCode.toDataURL(payload, { width: size, margin: 2, errorCorrectionLevel: "H" }).then((u) => alive && setUrl(u));
      });
    return () => {
      alive = false;
    };
  }, [payload, size]);
  return payload ? url : null;
}

/** Khung VietQR: logo VietQR · mã QR · napas 247 | logo ngân hàng. */
export function VietQrFrame({
  payload,
  bankBin,
  bankName,
  alt,
  className,
}: {
  payload: string;
  bankBin: string;
  bankName: string;
  alt: string;
  className?: string;
}) {
  const url = useVietQr(payload);
  return (
    <div className={cx("rounded-3xl border border-slate-200 bg-white px-4 pt-3 pb-4 text-slate-900", className)}>
      <Image src="/vietqr/vietqr.png" alt="VietQR" width={206} height={62} className="mx-auto h-7 w-auto" priority />
      <div className="mx-auto mt-2 aspect-square w-full max-w-64">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={alt} className="size-full" />
        ) : (
          <div className="size-full animate-pulse rounded-2xl bg-slate-100" />
        )}
      </div>
      <div className="mt-2 flex items-center justify-center gap-3">
        <Image src="/vietqr/napas247.png" alt="napas 247" width={128} height={30} className="h-5 w-auto" />
        <span className="h-6 w-px bg-slate-300" />
        <Image src={bankLogo(bankBin)} alt={bankName} width={120} height={45} className="h-7 w-auto max-w-28 object-contain" />
      </div>
    </div>
  );
}

/* ---------------- Ảnh VietQR để lưu / chia sẻ ---------------- */

function drawContain(g: CanvasRenderingContext2D, img: HTMLImageElement, cx: number, y: number, maxW: number, maxH: number) {
  const s = Math.min(maxW / img.width, maxH / img.height);
  g.drawImage(img, cx - (img.width * s) / 2, y + (maxH - img.height * s) / 2, img.width * s, img.height * s);
}

export interface VietQrPanelInput {
  payload: string;
  bankBin: string;
  bankName: string;
  accountNo: string;
  accountName: string;
  content: string;
  /** Bo góc nền trắng (khi ghép vào thẻ); mặc định nền vuông để lưu thành ảnh riêng. */
  rounded?: boolean;
}

/** Khung trắng kiểu VietQR: logo · QR · napas | ngân hàng · STK · nội dung. Rộng 600px. */
export async function renderVietQrPanel(p: VietQrPanelInput): Promise<HTMLCanvasElement> {
  const W = 600;
  const H = 840;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d")!;
  const font = getComputedStyle(document.body).fontFamily;
  g.fillStyle = "#ffffff";
  if (p.rounded) {
    g.beginPath();
    g.roundRect(0, 0, W, H, 36);
    g.fill();
  } else g.fillRect(0, 0, W, H);

  const [wordmark, napas, bank, qr] = await Promise.all([
    loadImage("/vietqr/vietqr.png"),
    loadImage("/vietqr/napas247.png"),
    loadImage(bankLogo(p.bankBin)).catch(() => null),
    renderVietQr(p.payload, 720),
  ]);
  drawContain(g, wordmark, W / 2, 28, 210, 58);
  const qrSize = 450;
  g.drawImage(qr, (W - qrSize) / 2, 98, qrSize, qrSize);
  const rowY = 566;
  drawContain(g, napas, W / 2 - 92, rowY, 140, 36);
  g.fillStyle = "#cbd5e1";
  g.fillRect(W / 2 - 1, rowY - 2, 2, 42);
  if (bank) drawContain(g, bank, W / 2 + 92, rowY - 4, 140, 46);

  g.textAlign = "center";
  const y = 660;
  g.fillStyle = "#0f172a";
  g.font = `700 28px ${font}`;
  g.fillText(`${p.bankName} · ${p.accountNo}`, W / 2, y);
  g.fillStyle = "#64748b";
  g.font = `500 22px ${font}`;
  g.fillText(p.accountName, W / 2, y + 36);
  // nội dung trong khung cam nhạt
  g.fillStyle = "#fff1e6";
  g.beginPath();
  g.roundRect(40, y + 62, W - 80, 64, 18);
  g.fill();
  g.fillStyle = "#c2410c";
  g.font = `800 28px ${font}`;
  g.fillText(p.content, W / 2, y + 104);
  return c;
}

/**
 * Lưu ảnh: điện thoại → mở bảng chia sẻ (chọn "Lưu hình ảnh" để vào thư viện ảnh);
 * máy tính / trình duyệt không hỗ trợ → tải file PNG.
 */
export async function saveCanvasImage(canvas: HTMLCanvasElement, filename: string): Promise<"shared" | "downloaded" | "cancelled"> {
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
  if (!blob) throw new Error("toBlob failed");
  const file = new File([blob], filename, { type: "image/png" });
  const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  if (mobile && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return "shared";
    } catch (e) {
      if ((e as Error).name === "AbortError") return "cancelled";
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return "downloaded";
}
