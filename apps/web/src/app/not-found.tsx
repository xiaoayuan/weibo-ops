import Link from "next/link";

export default function NotFoundPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="app-surface max-w-xl text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-app-accent">404</p>
        <h1 className="mt-4 text-4xl font-semibold text-app-text-strong">页面不存在</h1>
        <p className="mt-4 text-sm leading-7 text-app-text-muted">这个页面还没有迁移到独立前端，或者地址写错了。你可以先回到控制台继续操作。</p>
        <Link href="/" className="app-button app-button-primary mt-8 inline-flex justify-center">
          返回控制台
        </Link>
      </div>
    </main>
  );
}
