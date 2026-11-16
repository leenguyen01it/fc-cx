/**
 * Sinh bộ icon của app (favicon, apple-icon, icon PWA) từ một hình SVG.
 * Chạy lại khi đổi màu / hình: node scripts/icons.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";
import sharp from "sharp";

const BG_FROM = "#f97316";
const BG_TO = "#ea580c";
const INK = "#9a3412";

/** Quả bóng (cùng hình với BallIcon trong app), vẽ trong khung 24×24. */
const ball = `
  <circle cx="12" cy="12" r="9.5" fill="#fff" stroke="${INK}" stroke-width="0.7"/>
  <path d="m12 7.2 4.1 3-1.6 4.8h-5l-1.6-4.8z" fill="${INK}" stroke="${INK}" stroke-width="0.9" stroke-linejoin="round"/>
  <path d="M12 7.2V2.6M16.1 10.2l4.3-1.5M14.5 15l2.8 3.8M9.5 15l-2.8 3.8M7.9 10.2 3.6 8.7" stroke="${INK}" stroke-width="1.1" stroke-linecap="round"/>`;

/**
 * @param {object} o
 * @param {number} o.radius  bo góc nền (0 = vuông, để iOS / Android tự bo)
 * @param {number} o.ball    tỷ lệ quả bóng so với cạnh (maskable cần ≤ 0.6 để nằm trong vùng an toàn)
 */
function svg({ radius, ball: k }) {
  const size = 512;
  const d = size * k;
  const off = (size - d) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${BG_FROM}"/><stop offset="1" stop-color="${BG_TO}"/></linearGradient></defs>
  <rect width="${size}" height="${size}" rx="${radius}" fill="url(#g)"/>
  <g transform="translate(${off} ${off}) scale(${d / 24})" fill="none">${ball}</g>
</svg>`;
}

const rounded = svg({ radius: 112, ball: 0.74 });
const square = svg({ radius: 0, ball: 0.7 });
const maskable = svg({ radius: 0, ball: 0.56 });

const png = (s, size) => sharp(Buffer.from(s)).resize(size, size).png({ compressionLevel: 9 }).toBuffer();

/** File .ico chứa sẵn PNG (trình duyệt hiện đại đều đọc được). */
function ico(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  const dir = Buffer.alloc(16 * images.length);
  let offset = 6 + dir.length;
  images.forEach(({ size, data }, i) => {
    const o = i * 16;
    dir.writeUInt8(size >= 256 ? 0 : size, o);
    dir.writeUInt8(size >= 256 ? 0 : size, o + 1);
    dir.writeUInt8(0, o + 2);
    dir.writeUInt8(0, o + 3);
    dir.writeUInt16LE(1, o + 4);
    dir.writeUInt16LE(32, o + 6);
    dir.writeUInt32LE(data.length, o + 8);
    dir.writeUInt32LE(offset, o + 12);
    offset += data.length;
  });
  return Buffer.concat([header, dir, ...images.map((x) => x.data)]);
}

mkdirSync("public/icons", { recursive: true });
writeFileSync("src/app/icon.svg", rounded);
writeFileSync("src/app/apple-icon.png", await png(square, 180));
writeFileSync(
  "src/app/favicon.ico",
  ico(await Promise.all([16, 32, 48].map(async (size) => ({ size, data: await png(rounded, size) })))),
);
writeFileSync("public/icons/icon-192.png", await png(rounded, 192));
writeFileSync("public/icons/icon-512.png", await png(rounded, 512));
writeFileSync("public/icons/maskable-512.png", await png(maskable, 512));
console.log("Đã sinh icon.");
