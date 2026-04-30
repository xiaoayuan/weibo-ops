import Link from "next/link";
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
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(45,212,191,0.16),transparent_30%),radial-gradient(circle_at_top_right,rgba(56,189,248,0.14),transparent_28%),linear-gradient(180deg,transparent,rgba(8,15,25,0.34))] opacity-90" />

      <div className="relative mx-auto grid w-full max-w-7xl gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="hidden rounded-[32px] border border-app-line/70 bg-app-panel/70 p-10 backdrop-blur lg:flex lg:flex-col lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-3 rounded-full border border-app-line bg-white/5 px-4 py-2 text-sm text-app-text-soft">
              <span className="h-2 w-2 rounded-full bg-app-accent" />
              微博运营台独立前端
            </div>
            <h1 className="mt-8 max-w-2xl text-5xl font-semibold leading-tight tracking-tight text-app-text-strong">
              为高频运营场景重做的深色工作台。
            </h1>
            <p className="mt-6 max-w-xl text-base leading-8 text-app-text-muted">
              新前端和后端 API 独立运行，保留你现有的执行能力、账号体系和日志链路，同时把整个管理台统一到更稳定、更专业的视觉语言里。
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-[24px] border border-app-line bg-app-panel-strong/70 p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-app-text-soft">主题</p>
              <p className="mt-3 text-lg font-medium text-app-text-strong">深浅双主题</p>
            </div>
            <div className="rounded-[24px] border border-app-line bg-app-panel-strong/70 p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-app-text-soft">架构</p>
              <p className="mt-3 text-lg font-medium text-app-text-strong">前后端解耦</p>
            </div>
            <div className="rounded-[24px] border border-app-line bg-app-panel-strong/70 p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-app-text-soft">目标</p>
              <p className="mt-3 text-lg font-medium text-app-text-strong">统一运营台体验</p>
            </div>
          </div>
        </section>

        <section className="flex items-center justify-center">
          <div className="w-full max-w-xl rounded-[32px] border border-app-line/80 bg-app-panel/88 p-8 shadow-[0_30px_90px_rgba(2,8,20,0.32)] backdrop-blur xl:p-10">
            <Link href="/" className="inline-flex items-center gap-3 text-sm text-app-text-soft transition hover:text-app-text-strong">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-app-line bg-app-panel-strong text-lg font-semibold text-app-text-strong">
                微
              </span>
              <span>微博运营台</span>
            </Link>

            <div className="mt-10">
              <h2 className="text-3xl font-semibold tracking-tight text-app-text-strong">{title}</h2>
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
