import Link from "next/link";
import { BarChart3, Bell, CalendarRange, ClipboardList, FileText, LayoutDashboard, MessageCircleHeart, RefreshCw, Settings, Shield, Tags, Users } from "lucide-react";
import type { ReactNode } from "react";

import { LogoutButton } from "@/components/auth/logout-button";
import { MobileNav } from "@/components/dashboard/mobile-nav";
import { hasRequiredRole, requirePageRole } from "@/lib/permissions";

const navItems = [
  { href: "/", label: "控制台", icon: LayoutDashboard, iconName: "LayoutDashboard" },
  { href: "/accounts", label: "账号管理", icon: Users, iconName: "Users" },
  { href: "/super-topics", label: "超话管理", icon: Tags, iconName: "Tags" },
  { href: "/topic-tasks", label: "任务配置", icon: ClipboardList, iconName: "ClipboardList" },
  { href: "/copywriting", label: "文案库", icon: FileText, iconName: "FileText" },
  { href: "/plans", label: "每日计划", icon: CalendarRange, iconName: "CalendarRange" },
  { href: "/interactions", label: "互动任务", icon: MessageCircleHeart, iconName: "MessageCircleHeart" },
  { href: "/ops", label: "控评与轮转", icon: RefreshCw, iconName: "RefreshCw" },
  { href: "/logs", label: "执行日志", icon: Bell, iconName: "Bell" },
  { href: "/traffic", label: "流量监控", icon: BarChart3, iconName: "BarChart3" },
  { href: "/scheduler", label: "调度监控", icon: RefreshCw, iconName: "RefreshCw" },
  { href: "/users", label: "用户管理", icon: Shield, iconName: "Shield", minRole: "ADMIN" as const },
  { href: "/settings", label: "系统设置", icon: Settings, iconName: "Settings", minRole: "ADMIN" as const },
];

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await requirePageRole("VIEWER");
  const visibleNavItems = navItems.filter((item) => !item.minRole || hasRequiredRole(session.role, item.minRole));

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto grid min-h-screen max-w-7xl grid-cols-1 lg:grid-cols-[240px_1fr]">
        <aside className="hidden border-b border-slate-200 bg-white p-6 lg:block lg:border-r lg:border-b-0">
          <div className="mb-8">
            <h1 className="text-xl font-semibold">微博运营台</h1>
            <p className="mt-1 text-sm text-slate-500">多账号任务管理后台</p>
          </div>

          <nav className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
            {visibleNavItems.map((item) => {
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-100"
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </Link>
              );
              })}
          </nav>
        </aside>

        <main className="p-6 lg:p-8">
          <MobileNav
            items={visibleNavItems.map((item) => ({ href: item.href, label: item.label, iconName: item.iconName }))}
            username={session.username}
            role={session.role}
          />
          <div className="mb-6 flex items-center justify-between gap-3">
            <div className="hidden text-sm text-slate-500 lg:block">
              当前用户：<span className="font-medium text-slate-700">{session.username}</span> / {session.role}
            </div>
            <div className="hidden lg:block">
              <LogoutButton />
            </div>
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
