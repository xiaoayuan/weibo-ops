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
    <main className="relative flex min-h-screen overflow-hidden bg-app-bg px-4 py-6 text-app-text sm:px-6 lg:px-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_14%_14%,rgba(125,211,199,0.14),transparent_22%),radial-gradient(circle_at_84%_10%,rgba(147,199,239,0.12),transparent_18%),linear-gradient(180deg,transparent,rgba(8,15,25,0.38))] opacity-90" />
      <div className="pointer-events-none absolute inset-y-0 left-[52%] hidden w-px bg-gradient-to-b from-transparent via-white/8 to-transparent lg:block" />

      <div className="relative mx-auto grid w-full max-w-7xl gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        {/* Left panel: tag + title + description */}
        <section className="hidden rounded-[28px] border border-app-line bg-app-panel/70 p-10 backdrop-blur lg:flex lg:items-center">
          <div>
            <div className="inline-flex items-center gap-3 rounded-full border border-app-line bg-app-panel-muted px-4 py-2 text-xs tracking-[0.18em] text-app-text-soft">
              <span className="h-2 w-2 rounded-full bg-app-accent" />
              厨师长后花园
            </div>
            <h1 className="mt-8 max-w-2xl text-[3.35rem] font-semibold leading-[1.02] tracking-[-0.06em] text-app-text-strong">
              厨师长微博数据管理
            </h1>
            <p className="mt-6 max-w-xl text-[15px] leading-8 text-app-text-muted">
              专业的微博数据管理平台，统一管理账号、任务、互动和数据分析。
            </p>
          </div>
        </section>

        {/* Right panel: logo + form */}
        <section className="flex items-center justify-center">
          <div className="w-full max-w-xl rounded-[28px] border border-app-line bg-app-panel/88 p-8 shadow-[0_36px_90px_rgba(2,8,20,0.34)] backdrop-blur xl:p-10">
            <div className="flex items-center gap-4">
              <img
                src="/txw-logo.png"
                alt="logo"
                className="h-14 w-14 rounded-[16px] border border-app-line object-cover shadow-[0_8px_32px_rgba(0,0,0,0.18)]"
              />
            </div>

            <div className="mt-10">
              <h2 className="text-[2rem] font-semibold tracking-[-0.05em] text-app-text-strong">{title}</h2>
              <p className="mt-3 text-sm leading-7 text-app-text-muted">{description}</p>
            </div>

            <div className="mt-8">{children}</div>

            <div className="mt-8 border-t border-app-line pt-6 text-sm text-app-text-muted">{footer}</div>
          </div>
        </section>
      </div>
    </main>
  );
}