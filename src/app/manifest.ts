import type { MetadataRoute } from "next";

/** Cài app lên màn hình chính (Android / iOS / máy tính). Icon sinh bằng: node scripts/icons.mjs */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "FC CX – Thu tiền bóng",
    short_name: "FC CX",
    description: "Điểm danh · đóng tiền bóng",
    lang: "vi",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ea580c",
    theme_color: "#ea580c",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Đóng tiền", url: "/?tab=no", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Admin", url: "/admin", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
