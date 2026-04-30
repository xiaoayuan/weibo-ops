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
            <div className="flex h-14 w-14 items-center justify-center rounded-[16px] border border-app-line bg-app-panel-muted text-xl font-semibold text-app-text-strong shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
              微
            </div>
            <div>
              <p className="text-lg font-semibold tracking-[-0.03em] text-app-text-strong">微博运营台</p>
              <p className="mt-1 text-sm text-app-text-muted">独立前端工作台</p>
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
                    "group relative flex items-center gap-3 rounded-[18px] px-4 py-3 text-sm transition",
                    active
                      ? "border border-app-line-strong bg-[linear-gradient(180deg,rgba(255,255,255,0.045),rgba(125,211,199,0.08))] text-app-text-strong shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                      : "border border-transparent text-app-text-muted hover:border-app-line hover:bg-white/[0.025] hover:text-app-text-strong",
                  )}
                >
                  {active ? <span className="absolute inset-y-3 left-0 w-px rounded-full bg-app-accent/90" /> : null}
                  <span className={cn("flex h-10 w-10 items-center justify-center rounded-[14px] border", active ? "border-app-accent/15 bg-app-accent-soft text-app-accent-strong" : "border-app-line bg-app-panel-muted text-app-text-soft") }>
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-medium">{item.label}</span>
                    <span className="mt-1 block truncate text-[11px] tracking-[0.02em] text-app-text-soft">{item.description}</span>
                  </span>
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
                  className="inline-flex h-11 w-11 items-center justify-center rounded-[14px] border border-app-line bg-app-panel-muted lg:hidden"
                >
                  <Menu className="h-5 w-5" />
                </button>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-app-text-soft">运营控制台</p>
                  <h2 className="mt-1.5 text-[1.8rem] font-semibold tracking-[-0.05em] text-app-text-strong">{activeItem.label}</h2>
                  <p className="mt-1.5 text-sm text-app-text-muted">{activeItem.description}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <ThemeToggle />
                <div className="hidden items-center gap-3 rounded-[16px] border border-app-line bg-app-panel-muted px-3 py-2 md:flex">
                  <div className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-app-accent-soft text-sm font-semibold text-app-accent-strong">
                    {getInitials(session.username)}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-app-text-strong">{session.username}</p>
                    <p className="text-[11px] uppercase tracking-[0.16em] text-app-text-soft">{getRoleText(session.role)}</p>
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
        <div className="fixed inset-0 z-50 bg-slate-950/60 px-4 py-4 lg:hidden">
          <div className="flex h-full max-w-sm flex-col rounded-[24px] border border-app-line bg-app-panel shadow-2xl">
            <div className="flex items-center justify-between border-b border-app-line px-5 py-5">
              <div>
                <p className="text-lg font-semibold text-app-text-strong">微博运营台</p>
                <p className="mt-1 text-sm text-app-text-muted">独立前端工作台</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="inline-flex h-10 w-10 items-center justify-center rounded-[14px] border border-app-line bg-app-panel-muted">
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
              <div className="flex items-center gap-3 rounded-[18px] border border-app-line bg-app-panel-muted px-4 py-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-app-accent-soft text-sm font-semibold text-app-accent-strong">
                  {getInitials(session.username)}
                </div>
                <div>
                  <p className="text-sm font-medium text-app-text-strong">{session.username}</p>
                  <p className="text-[11px] uppercase tracking-[0.16em] text-app-text-soft">{getRoleText(session.role)}</p>
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
