import { cn } from "@/lib/utils";

const toneMap = {
  error: "border-rose-300/16 bg-rose-300/10 text-rose-200",
  success: "border-emerald-300/16 bg-emerald-300/10 text-emerald-200",
  info: "border-sky-300/16 bg-sky-300/10 text-sky-200",
} as const;

export function AppNotice({
  tone,
  children,
  className,
}: {
  tone: keyof typeof toneMap;
  children: React.ReactNode;
  className?: string;
}) {
  return <p className={cn("rounded-[16px] border px-4 py-3 text-sm leading-6", toneMap[tone], className)}>{children}</p>;
}
