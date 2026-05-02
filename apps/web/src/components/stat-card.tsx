import type { ReactNode } from "react";

import { SurfaceCard } from "@/components/surface-card";

export function StatCard({
  label,
  value,
  detail,
  accent,
  icon,
  onClick,
  cursorPointer,
}: {
  label: string;
  value: string;
  detail: string;
  accent?: "accent" | "success" | "danger" | "warning" | "info";
  icon?: ReactNode;
  onClick?: () => void;
  cursorPointer?: boolean;
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

  const accentGlow =
    accent === "success"
      ? "from-emerald-400/10"
      : accent === "danger"
        ? "from-rose-400/10"
        : accent === "warning"
          ? "from-amber-400/10"
          : accent === "info"
            ? "from-blue-400/10"
            : "from-orange-400/10";

  return (
    <SurfaceCard className={`group relative overflow-hidden rounded-[22px] p-5${cursorPointer ? " cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-lg active:translate-y-0" : ""}`}>
      {/* Subtle gradient background */}
      <div className={`absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gradient-to-br ${accentGlow} to-transparent opacity-50 blur-3xl transition-all duration-500 group-hover:scale-125 group-hover:opacity-70`} />
      
      <div className="relative flex items-start justify-between gap-4">
        <div className="flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-app-text-soft transition-colors duration-300 group-hover:text-app-text">{label}</p>
          <p className="mt-5 text-[2rem] font-bold tracking-tight text-app-text-strong transition-all duration-300 group-hover:scale-105">{value}</p>
          <p className={`mt-3 text-sm font-medium ${accentClass} transition-all duration-300`}>{detail}</p>
        </div>
        {icon ? (
          <div className="rounded-[18px] border border-app-line bg-app-panel-muted p-3 text-app-text-soft transition-all duration-300 group-hover:scale-105 group-hover:border-app-line-strong group-hover:bg-app-panel-strong group-hover:text-app-text">
            {icon}
          </div>
        ) : null}
      </div>
      {onClick ? <button type="button" onClick={onClick} className="absolute inset-0 cursor-pointer opacity-0" aria-label={label} /> : null}
    </SurfaceCard>
  );
}
