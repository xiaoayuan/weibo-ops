import type { ReactNode } from "react";

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        {eyebrow ? <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-app-text-soft">{eyebrow}</p> : null}
        <h1 className="mt-3 max-w-5xl text-3xl font-semibold tracking-[-0.04em] text-app-text-strong lg:text-[2.65rem]">{title}</h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-app-text-muted">{description}</p>
      </div>
      {action ? <div className="flex shrink-0 items-center gap-3">{action}</div> : null}
    </div>
  );
}
