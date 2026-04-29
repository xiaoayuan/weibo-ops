"use client";

import Link from "next/link";
import { useState } from "react";

import { LogoutButton } from "@/components/auth/logout-button";
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
} from "@/lib/icons";

type NavItem = {
  href: string;
  label: string;
  iconName: string;
};

const iconMap = {
  Bell,
  BarChart3,
  CalendarRange,
  ClipboardList,
  FileText,
  LayoutDashboard,
  MessageCircleHeart,
  RefreshCw,
  Settings,
  Shield,
  Tags,
  Users,
};

export function MobileNav({ items, username, role }: { items: NavItem[]; username: string; role: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="lg:hidden">
      <div className="mb-4 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
        >
          <Menu size={16} className="h-4 w-4" />
          菜单
        </button>
        <div className="text-right text-sm text-slate-500">
          <div>{username}</div>
          <div>{role}</div>
        </div>
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 bg-slate-900/40">
          <div className="h-full w-72 bg-white p-5 shadow-xl">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">微博运营台</h2>
                <p className="mt-1 text-xs text-slate-500">多账号任务管理后台</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-slate-200 p-2 text-slate-700">
                <X size={16} className="h-4 w-4" />
              </button>
            </div>

            <nav className="space-y-2">
              {items.map((item) => {
                const Icon = iconMap[item.iconName as keyof typeof iconMap] || LayoutDashboard;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-100"
                  >
                    <Icon size={16} className="h-4 w-4" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            <div className="mt-6 border-t border-slate-200 pt-4">
              <div className="mb-3 text-sm text-slate-500">
                当前用户：<span className="font-medium text-slate-700">{username}</span>
              </div>
              <LogoutButton />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
