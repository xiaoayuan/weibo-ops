import { cn } from "@/lib/utils";

const toneClassMap = {
  neutral: "border-app-line bg-app-panel-muted text-app-text-soft",
  success: "border-app-success/15 bg-app-success/10 text-app-success",
  danger: "border-app-danger/15 bg-app-danger/10 text-app-danger",
  warning: "border-app-warning/15 bg-app-warning/10 text-app-warning",
  info: "border-app-info/15 bg-app-info/10 text-app-info",
  accent: "border-app-accent/15 bg-app-accent/10 text-app-accent",
} as const;

export function StatusBadge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: keyof typeof toneClassMap;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium tracking-[0.08em]",
        toneClassMap[tone],
      )}
    >
      {children}
    </span>
  );
}
