import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "weibo-ops api",
  description: "Standalone API service for weibo-ops",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
