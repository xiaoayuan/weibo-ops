import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function TableShell({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("overflow-x-auto rounded-[22px] border border-app-line", className)}>{children}</div>;
}
