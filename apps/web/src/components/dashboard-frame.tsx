"use client";

import {
  BarChart3,
  Bell,
  CalendarRange,
  ClipboardList,
  FileText,
  LayoutDashboard,
  Menu,
  MessageCircleHeart,
  RefreshCw,
  Settings,
  Shield,
  Tags,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { LogoutButton } from "@/components/logout-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { getRoleText, hasRequiredRole, type SessionUser } from "@/lib/auth-shared";
import { navItems } from "@/lib/nav";
import { cn } from "@/lib/utils";

const iconMap = {
  bell: Bell,
  "bar-chart-3": BarChart3,
  "calendar-range": CalendarRange,
  "clipboard-list": ClipboardList,
  "file-text": FileText,
  "layout-dashboard": LayoutDashboard,
  "message-circle-heart": MessageCircleHeart,
  "refresh-cw": RefreshCw,
  settings: Settings,
  shield: Shield,
  tags: Tags,
  users: Users,
};

function getInitials(username: string) {
  return username.slice(0, 2).toUpperCase();
}

export function DashboardFrame({ children, session }: { children: React.ReactNode; session: SessionUser }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const visibleNavItems = navItems.filter((item) => !item.minRole || hasRequiredRole(session.role, item.minRole));
  const activeItem = visibleNavItems.find((item) => (item.href === "/" ? pathname === "/" : pathname.startsWith(item.href))) || visibleNavItems[0];

  return (
    <div className="min-h-screen bg-app-bg text-app-text">
      <div className="mx-auto grid min-h-screen max-w-[1680px] grid-cols-1 gap-5 px-4 py-4 lg:grid-cols-[286px_minmax(0,1fr)] lg:px-6 lg:py-6 xl:gap-6">
        <aside className="app-surface sticky top-6 hidden h-[calc(100vh-3rem)] flex-col overflow-hidden rounded-[26px] p-0 lg:flex">
          <div className="flex items-center gap-4 border-b border-app-line px-6 py-6">
            <div className="relative flex h-14 w-14 items-center justify-center rounded-[16px] border border-app-accent/30 bg-gradient-to-br from-fuchsia-500/20 to-purple-500/20 text-xl font-semibold text-app-accent-strong shadow-[inset_0_1px_0_rgba(232,121,249,0.15),0_0_20px_rgba(232,121,249,0.25)]">
              <span className="relative z-10">薇</span>
              <div className="absolute inset-0 rounded-[16px] bg-gradient-to-br from-fuchsia-400/10 to-purple-400/10 blur-sm" />
            </div>
            <div>
              <p className="bg-gradient-to-r from-fuchsia-300 to-purple-300 bg-clip-text text-lg font-semibold tracking-[-0.03em] text-transparent">田曦薇应援站</p>
              <p className="mt-1 text-sm text-app-text-muted">微博运营管理系统</p>
            </div>
          </div>

          <nav className="flex-1 space-y-1.5 overflow-y-auto px-4 py-5">
            {visibleNavItems.map((item) => {
              const Icon = iconMap[item.icon];
              const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

              return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-[18px] border px-4 py-3 text-sm transition-all duration-200",
                      active 
                        ? "border-app-accent/30 bg-gradient-to-r from-fuchsia-500/15 to-purple-500/15 text-app-text-strong shadow-[0_0_20px_rgba(232,121,249,0.2)]" 
                        : "border-transparent text-app-text-muted hover:border-app-line hover:bg-white/[0.025] hover:text-app-text-strong",
                    )}
                  >
                    <span className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-[14px] border transition-all duration-200",
                      active 
                        ? "border-app-accent/30 bg-gradient-to-br from-fuchsia-400/20 to-purple-400/20 text-app-accent shadow-[0_0_15px_rgba(232,121,249,0.3)]" 
                        : "border-app-line bg-app-panel-muted text-app-text-soft"
                    )}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="font-medium">{item.label}</p>
                      <p className="text-[11px] text-app-text-soft">{item.description}</p>
                    </div>
                  </Link>
              );
            })}
          </nav>

          <div className="border-t border-app-line px-6 py-5">
            <div className="rounded-[18px] border border-app-line bg-app-panel-muted p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-app-text-soft">部署模式</p>
              <p className="mt-3 text-sm leading-6 text-app-text-muted">当前前端已经独立为 `apps/web`，后端继续复用现有 API 与执行服务。</p>
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-col gap-5 lg:gap-6">
          <header className="app-surface sticky top-4 z-20 rounded-[22px] px-5 py-4 backdrop-blur lg:top-6 lg:px-6">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setOpen(true)}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-[14px] border border-app-accent/20 bg-gradient-to-br from-fuchsia-500/10 to-purple-500/10 text-app-accent transition-all duration-200 hover:shadow-[0_0_15px_rgba(232,121,249,0.3)] active:scale-95 lg:hidden"
                >
                  <Menu className="h-5 w-5" />
                </button>
                <div className="hidden lg:block">
                  <p className="bg-gradient-to-r from-fuchsia-300 to-purple-300 bg-clip-text text-base font-semibold tracking-[-0.02em] text-transparent">{activeItem?.label || "控制台"}</p>
                  <p className="mt-0.5 text-xs text-app-text-soft">{activeItem?.description || "管理和监控"}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <ThemeToggle />
                <div className="hidden items-center gap-3 rounded-[16px] border border-app-accent/20 bg-gradient-to-r from-fuchsia-500/10 to-purple-500/10 px-3 py-2 shadow-[0_0_10px_rgba(232,121,249,0.15)] md:flex">
                  <div className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-gradient-to-br from-fuchsia-400 to-purple-400 text-sm font-semibold text-white shadow-[0_0_10px_rgba(232,121,249,0.3)]">
                    {getInitials(session.username)}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-app-text-strong">{session.username}</p>
                    <p className="text-[11px] uppercase tracking-[0.16em] text-app-accent">{getRoleText(session.role)}</p>
                  </div>
                </div>
                <div className="hidden md:block">
                  <LogoutButton />
                </div>
              </div>
            </div>
          </header>

          <main className="min-w-0 pb-8">{children}</main>
        </div>
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 bg-slate-950/60 px-4 py-4 backdrop-blur-sm lg:hidden">
          <div className="flex h-full max-w-sm flex-col rounded-[24px] border border-app-accent/20 bg-app-panel shadow-[0_0_50px_rgba(232,121,249,0.3)]">
            <div className="flex items-center justify-between border-b border-app-line px-5 py-5">
              <div className="flex items-center gap-3">
                <div className="relative flex h-10 w-10 items-center justify-center rounded-[12px] border border-app-accent/30 bg-gradient-to-br from-fuchsia-500/20 to-purple-500/20 text-base font-semibold text-app-accent-strong shadow-[0_0_15px_rgba(232,121,249,0.2)]">
                  <span className="relative z-10">薇</span>
                </div>
                <div>
                  <p className="bg-gradient-to-r from-fuchsia-300 to-purple-300 bg-clip-text text-base font-semibold tracking-[-0.02em] text-transparent">田曦薇应援站</p>
                  <p className="text-xs text-app-text-soft">微博运营管理</p>
                </div>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="inline-flex h-10 w-10 items-center justify-center rounded-[14px] border border-app-line bg-app-panel-muted text-app-text-soft transition-all duration-200 hover:border-app-accent/30 hover:text-app-accent active:scale-95">
                <X className="h-4 w-4" />
              </button>
            </div>

            <nav className="flex-1 space-y-1 overflow-y-auto px-4 py-4">
              {visibleNavItems.map((item) => {
                const Icon = iconMap[item.icon];
                const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-[18px] border px-4 py-3 text-sm transition",
                      active ? "border-app-line-strong bg-app-accent-soft text-app-text-strong" : "border-transparent text-app-text-muted hover:border-app-line hover:bg-white/[0.025] hover:text-app-text-strong",
                    )}
                  >
                    <span className="flex h-10 w-10 items-center justify-center rounded-[14px] border border-app-line bg-app-panel-muted text-app-text-soft">
                      <Icon className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="font-medium">{item.label}</p>
                      <p className="text-[11px] text-app-text-soft">{item.description}</p>
                    </div>
                  </Link>
                );
              })}
            </nav>

            <div className="space-y-4 border-t border-app-line px-5 py-5">
              <div className="flex items-center gap-3 rounded-[18px] border border-app-accent/20 bg-gradient-to-r from-fuchsia-500/10 to-purple-500/10 px-4 py-3 shadow-[0_0_15px_rgba(232,121,249,0.15)]">
                <div className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-gradient-to-br from-fuchsia-400 to-purple-400 text-sm font-semibold text-white shadow-[0_0_15px_rgba(232,121,249,0.4)]">
                  {getInitials(session.username)}
                </div>
                <div>
                  <p className="text-sm font-medium text-app-text-strong">{session.username}</p>
                  <p className="text-[11px] uppercase tracking-[0.16em] text-app-accent">{getRoleText(session.role)}</p>
                </div>
              </div>
              <div className="flex gap-3">
                <ThemeToggle />
                <LogoutButton />
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
