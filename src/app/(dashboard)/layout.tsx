import Link from "next/link";
import { Bell, CalendarRange, ClipboardList, FileText, LayoutDashboard, MessageCircleHeart, Settings, Shield, Tags, Users } from "lucide-react";
import type { ReactNode } from "react";

import { LogoutButton } from "@/components/auth/logout-button";
import { hasRequiredRole, requirePageRole } from "@/lib/permissions";

const navItems = [
  { href: "/", label: "控制台", icon: LayoutDashboard },
  { href: "/accounts", label: "账号管理", icon: Users },
  { href: "/super-topics", label: "超话管理", icon: Tags },
  { href: "/topic-tasks", label: "任务配置", icon: ClipboardList },
  { href: "/copywriting", label: "文案库", icon: FileText },
  { href: "/plans", label: "每日计划", icon: CalendarRange },
  { href: "/interactions", label: "互动任务", icon: MessageCircleHeart },
  { href: "/logs", label: "执行日志", icon: Bell },
  { href: "/users", label: "用户管理", icon: Shield, minRole: "ADMIN" as const },
  { href: "/settings", label: "系统设置", icon: Settings },
];

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await requirePageRole("VIEWER");

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto grid min-h-screen max-w-7xl grid-cols-1 lg:grid-cols-[240px_1fr]">
        <aside className="border-b border-slate-200 bg-white p-6 lg:border-r lg:border-b-0">
          <div className="mb-8">
            <h1 className="text-xl font-semibold">微博运营台</h1>
            <p className="mt-1 text-sm text-slate-500">多账号任务管理后台</p>
          </div>

          <nav className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
            {navItems
              .filter((item) => !item.minRole || hasRequiredRole(session.role, item.minRole))
              .map((item) => {
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
          <div className="mb-6 flex items-center justify-between gap-3">
            <div className="text-sm text-slate-500">
              当前用户：<span className="font-medium text-slate-700">{session.username}</span> / {session.role}
            </div>
            <LogoutButton />
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
