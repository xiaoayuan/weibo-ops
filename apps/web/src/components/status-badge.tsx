import { cn } from "@/lib/utils";

const toneClassMap = {
  neutral: "border-white/10 bg-white/5 text-app-text-soft",
  success: "border-emerald-400/20 bg-emerald-400/12 text-emerald-200",
  danger: "border-rose-400/20 bg-rose-400/12 text-rose-200",
  warning: "border-amber-400/20 bg-amber-400/12 text-amber-200",
  info: "border-cyan-400/20 bg-cyan-400/12 text-cyan-200",
  accent: "border-teal-400/20 bg-teal-400/12 text-teal-100",
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
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium tracking-wide",
        toneClassMap[tone],
      )}
    >
      {children}
    </span>
  );
}
