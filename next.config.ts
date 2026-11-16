import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cho phép build song song vào thư mục khác (VD kiểm tra bản production khi đang chạy dev)
  distDir: process.env.NEXT_DIST_DIR || ".next",
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
