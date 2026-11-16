import type { Metadata, Viewport } from "next";
import { Be_Vietnam_Pro } from "next/font/google";
import "react-day-picker/style.css";
import "./globals.css";
import { Toaster } from "@/components/ui/toast";

const font = Be_Vietnam_Pro({
  variable: "--font-be-vietnam",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700", "800"],
});

const siteUrl =
  process.env.SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "FC CX",
  description: "Điểm danh · đóng tiền bóng",
  openGraph: {
    title: "FC CX",
    description: "Điểm danh · đóng tiền bóng",
    images: [{ url: "/team/og.jpg", width: 1200, height: 630, alt: "FC CX" }],
    type: "website",
    locale: "vi_VN",
  },
  twitter: { card: "summary_large_image", images: ["/team/og.jpg"] },
  applicationName: "FC CX",
  // iOS: mở từ màn hình chính như app, thanh trạng thái nằm đè lên ảnh đầu trang
  appleWebApp: { capable: true, title: "FC CX", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Cho phép nội dung tràn vào vùng tai thỏ / thanh home – các trang đã chừa bằng env(safe-area-inset-*)
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ea580c" },
    { media: "(prefers-color-scheme: dark)", color: "#9a3412" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="vi" className={`${font.variable} h-full antialiased`}>
      <body className="min-h-full font-sans">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
