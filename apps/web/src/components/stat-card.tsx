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
      ? "from-app-success/20"
      : accent === "danger"
        ? "from-app-danger/20"
        : accent === "warning"
          ? "from-app-warning/20"
          : accent === "info"
            ? "from-app-info/20"
            : "from-app-accent/20";

  return (
    <SurfaceCard className={`group relative overflow-hidden rounded-[22px] p-5${cursorPointer ? " cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-black/30 active:translate-y-0" : ""}`}>
      {/* Top shine */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/12 to-transparent" />
      
      {/* Animated glow orb */}
      <div className={`absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gradient-to-br ${accentGlow} to-transparent opacity-60 blur-3xl transition-all duration-500 group-hover:scale-150 group-hover:opacity-80`} />
      
      {/* Accent line */}
      <div className={`absolute bottom-0 left-0 h-1 w-0 bg-gradient-to-r ${accentGlow} to-transparent transition-all duration-500 group-hover:w-full`} />
      
      <div className="relative flex items-start justify-between gap-4">
        <div className="flex-1">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-app-text-soft transition-colors duration-300 group-hover:text-app-text">{label}</p>
          <p className="mt-5 text-[2rem] font-semibold tracking-[-0.05em] text-app-text-strong transition-all duration-300 group-hover:scale-105">{value}</p>
          <p className={`mt-3 text-sm font-medium ${accentClass} transition-all duration-300`}>{detail}</p>
        </div>
        {icon ? (
          <div className="rounded-[18px] border border-app-line bg-app-panel-muted p-3 text-app-text-soft shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-all duration-300 group-hover:scale-110 group-hover:border-app-line-strong group-hover:bg-app-panel-strong group-hover:text-app-text">
            {icon}
          </div>
        ) : null}
      </div>
      {onClick ? <button type="button" onClick={onClick} className="absolute inset-0 cursor-pointer opacity-0" aria-label={label} /> : null}
    </SurfaceCard>
  );
}
