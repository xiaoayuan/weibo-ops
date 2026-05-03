import type { ReactNode } from "react";

export function AuthShell({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-app-bg px-4 py-6 text-app-text sm:px-6 sm:py-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_14%_14%,rgba(125,211,199,0.14),transparent_22%),radial-gradient(circle_at_84%_10%,rgba(147,199,239,0.12),transparent_18%),linear-gradient(180deg,transparent,rgba(8,15,25,0.38))] opacity-90" />

      <div className="relative w-full max-w-xl">
        <div className="flex items-center gap-4 mb-8">
          <img
            src="/txw-logo.png"
            alt="logo"
            className="h-14 w-14 rounded-full border border-app-line object-cover shadow-[0_8px_32px_rgba(0,0,0,0.18)]"
          />
        </div>

        <div className="rounded-[28px] border border-app-line bg-app-panel/88 p-8 shadow-[0_36px_90px_rgba(2,8,20,0.34)] backdrop-blur xl:p-10">
          <div>
            <h2 className="text-[2rem] font-semibold tracking-[-0.05em] text-app-text-strong">{title}</h2>
            <p className="mt-3 text-sm leading-7 text-app-text-muted">{description}</p>
          </div>

          <div className="mt-8">{children}</div>

          <div className="mt-8 border-t border-app-line pt-6 text-sm text-app-text-muted">{footer}</div>
        </div>
      </div>
    </main>
  );
}
