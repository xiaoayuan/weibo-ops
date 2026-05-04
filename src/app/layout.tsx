import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ensureActionJobDispatcherStarted } from "@/server/action-jobs/dispatcher";
import { ensureUserAutomationSchedulerStarted } from "@/server/scheduler/user-automation";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Ensure schedulers start on first module load (cannot be tree-shaken by Next.js)
(function initSchedulers() {
  ensureActionJobDispatcherStarted();
  ensureUserAutomationSchedulerStarted();
})();

export const metadata: Metadata = {
  title: "微博运营台",
  description: "微博多账号运营后台",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-slate-50 text-slate-900 flex flex-col">
        {children}
      </body>
    </html>
  );
}
