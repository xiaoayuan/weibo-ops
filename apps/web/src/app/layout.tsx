import type { Metadata } from "next";
import { Toaster } from "sonner";

import { ErrorBoundary } from "@/components/error-boundary";
import "./globals.css";

const themeBootScript = `(() => {
  try {
    const stored = window.localStorage.getItem("weibo-ops-theme");
    const systemPrefersLight = window.matchMedia("(prefers-color-scheme: light)").matches;
    
    let theme;
    if (stored === "light" || stored === "dark") {
      theme = stored;
    } else if (stored === "system" || !stored) {
      theme = systemPrefersLight ? "light" : "dark";
    } else {
      theme = "dark";
    }
    
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  } catch {
    document.documentElement.dataset.theme = "dark";
    document.documentElement.style.colorScheme = "dark";
  }
})();`;

export const metadata: Metadata = {
  title: "微博运营台前端",
  description: "厨师长后花园 - 微博数据管理",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body>
        <ErrorBoundary>
          {children}
        </ErrorBoundary>
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
