import { cn } from "@/lib/utils";

const toneClassMap = {
  neutral: "border-app-line bg-app-panel-muted text-app-text-soft",
  success: "border-emerald-300/10 bg-emerald-300/10 text-emerald-200",
  danger: "border-rose-300/10 bg-rose-300/10 text-rose-200",
  warning: "border-amber-200/12 bg-amber-200/10 text-amber-100",
  info: "border-sky-300/10 bg-sky-300/10 text-sky-200",
  accent: "border-teal-200/10 bg-teal-200/10 text-teal-100",
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
