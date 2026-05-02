import { cn } from "@/lib/utils";

const toneClassMap = {
  neutral: "border-app-line bg-app-panel-muted text-app-text-soft",
  success: "border-app-success/20 bg-app-success/12 text-app-success shadow-[0_0_12px_rgba(127,214,164,0.15)]",
  danger: "border-app-danger/20 bg-app-danger/12 text-app-danger shadow-[0_0_12px_rgba(243,154,167,0.15)]",
  warning: "border-app-warning/20 bg-app-warning/12 text-app-warning shadow-[0_0_12px_rgba(230,190,122,0.15)]",
  info: "border-app-info/20 bg-app-info/12 text-app-info shadow-[0_0_12px_rgba(147,199,239,0.15)]",
  accent: "border-app-accent/20 bg-app-accent/12 text-app-accent shadow-[0_0_12px_rgba(125,211,199,0.15)]",
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
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-[0.08em] transition-all duration-200 hover:scale-105",
        toneClassMap[tone],
      )}
    >
      {children}
    </span>
  );
}
