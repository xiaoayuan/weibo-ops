import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function SurfaceCard({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn("app-surface", className)}>{children}</section>;
}
