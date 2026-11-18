/**
 * Sinh chuỗi VietQR (chuẩn EMVCo / NAPAS 247) để mọi app ngân hàng quét được.
 * Không cần gọi API bên ngoài.
 */

/** Độ dài tối đa nội dung chuyển khoản trong mã QR (EMVCo tag 62-08). */
export const MAX_CONTENT = 25;

function tlv(id: string, value: string): string {
  return id + String(value.length).padStart(2, "0") + value;
}

/** CRC-16/CCITT-FALSE (poly 0x1021, init 0xFFFF). */
export function crc16(input: string): string {
  let crc = 0xffff;
  for (let i = 0; i < input.length; i++) {
    crc ^= input.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

export interface VietQrInput {
  bankBin: string;
  accountNo: string;
  /** Để trống → QR tĩnh, người chuyển tự nhập số tiền. */
  amount?: number;
  /** Nội dung chuyển khoản, nên là ASCII không dấu. */
  content?: string;
}

export function buildVietQr({ bankBin, accountNo, amount, content }: VietQrInput): string {
  const beneficiary = tlv("00", bankBin) + tlv("01", accountNo);
  const merchant = tlv("00", "A000000727") + tlv("01", beneficiary) + tlv("02", "QRIBFTTA");
  const hasAmount = amount != null && amount > 0;

  let payload =
    tlv("00", "01") +
    tlv("01", hasAmount ? "12" : "11") +
    tlv("38", merchant) +
    tlv("53", "704") +
    (hasAmount ? tlv("54", String(Math.round(amount))) : "") +
    tlv("58", "VN");

  // Chuẩn EMVCo: "mục đích giao dịch" tối đa 25 ký tự
  if (content) payload += tlv("62", tlv("08", content.slice(0, MAX_CONTENT)));
  payload += "6304";
  return payload + crc16(payload);
}

/** Danh sách ngân hàng phổ biến: mã BIN theo NAPAS, code dùng cho deeplink VietQR. */
export const BANKS: { bin: string; name: string; code: string }[] = [
  { bin: "970422", name: "MB Bank", code: "mb" },
  { bin: "970436", name: "Vietcombank", code: "vcb" },
  { bin: "970407", name: "Techcombank", code: "tcb" },
  { bin: "970418", name: "BIDV", code: "bidv" },
  { bin: "970415", name: "VietinBank", code: "icb" },
  { bin: "970405", name: "Agribank", code: "vba" },
  { bin: "970416", name: "ACB", code: "acb" },
  { bin: "970432", name: "VPBank", code: "vpb" },
  { bin: "970423", name: "TPBank", code: "tpb" },
  { bin: "970403", name: "Sacombank", code: "stb" },
  { bin: "970441", name: "VIB", code: "vib" },
  { bin: "970437", name: "HDBank", code: "hdb" },
  { bin: "970443", name: "SHB", code: "shb" },
  { bin: "970448", name: "OCB", code: "ocb" },
  { bin: "970426", name: "MSB", code: "msb" },
  { bin: "970440", name: "SeABank", code: "seab" },
  { bin: "970431", name: "Eximbank", code: "eib" },
  { bin: "970449", name: "LPBank", code: "lpb" },
  { bin: "970428", name: "Nam A Bank", code: "nab" },
  { bin: "970409", name: "Bac A Bank", code: "bab" },
  { bin: "970452", name: "KienlongBank", code: "klb" },
  { bin: "970425", name: "ABBANK", code: "abb" },
  { bin: "970454", name: "BVBank", code: "vccb" },
  { bin: "970412", name: "PVcomBank", code: "pvcb" },
  { bin: "970433", name: "VietBank", code: "vietbank" },
];

/**
 * Link mở app ngân hàng, điền sẵn thông tin chuyển khoản (dịch vụ deeplink của VietQR).
 * Dựng y hệt link mẫu của VietQR – app ngân hàng (VD MB) không tự điền nếu link khác mẫu:
 *  - thứ tự app, am, tn, ba, url; không gửi bn
 *  - "@" trong ba và ":/" trong url để nguyên (không mã hoá), khoảng trắng thành "+"
 *  - nội dung chỉ chữ & số, tối đa 25 ký tự; url chỉ origin + path (không query)
 */
export function bankAppDeeplink(o: {
  app: string;
  bankBin: string;
  accountNo: string;
  amount: number;
  content: string;
  returnUrl: string;
}): string | null {
  const bank = BANKS.find((b) => b.bin === o.bankBin);
  if (!bank || !/^\d+$/.test(o.accountNo)) return null;
  const tn = o.content
    .replace(/[^A-Za-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_CONTENT)
    .trim()
    .replace(/ /g, "+");
  let back = o.returnUrl;
  try {
    const u = new URL(o.returnUrl);
    back = u.origin + u.pathname;
  } catch {}
  // Giữ ":/" như mẫu, chỉ mã hoá ký tự lạ (nếu có)
  back = back.replace(/[^A-Za-z0-9:/._~-]/g, (c) => encodeURIComponent(c));
  const app = encodeURIComponent(o.app);
  return `https://dl.vietqr.io/pay?app=${app}&am=${Math.round(o.amount)}&tn=${tn}&ba=${o.accountNo}@${bank.code}&url=${back}`;
}
