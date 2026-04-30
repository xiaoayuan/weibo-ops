import type { ReactNode } from "react";

import { SurfaceCard } from "@/components/surface-card";

export function StatCard({
  label,
  value,
  detail,
  accent,
  icon,
}: {
  label: string;
  value: string;
  detail: string;
  accent?: "accent" | "success" | "danger" | "warning" | "info";
  icon?: ReactNode;
}) {
  const accentClass =
    accent === "success"
      ? "text-app-success"
      : accent === "danger"
        ? "text-app-danger"
        : accent === "warning"
          ? "text-app-warning"
          : accent === "info"
            ? "text-app-info"
            : "text-app-accent";

  return (
    <SurfaceCard className="relative overflow-hidden rounded-[22px] p-5">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/12 to-transparent" />
      <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-white/[0.03] blur-2xl" />
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-app-text-soft">{label}</p>
          <p className="mt-5 text-[2rem] font-semibold tracking-[-0.05em] text-app-text-strong">{value}</p>
          <p className={`mt-3 text-sm ${accentClass}`}>{detail}</p>
        </div>
        {icon ? <div className="rounded-[18px] border border-app-line bg-app-panel-muted p-3 text-app-text-soft shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">{icon}</div> : null}
      </div>
    </SurfaceCard>
  );
}
