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
    <SurfaceCard className="relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-app-text-muted">{label}</p>
          <p className="mt-4 text-3xl font-semibold tracking-tight text-app-text-strong">{value}</p>
          <p className={`mt-3 text-sm ${accentClass}`}>{detail}</p>
        </div>
        {icon ? <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-app-text-soft">{icon}</div> : null}
      </div>
    </SurfaceCard>
  );
}
