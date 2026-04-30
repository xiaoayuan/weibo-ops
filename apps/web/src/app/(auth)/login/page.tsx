import Link from "next/link";

import { AuthShell } from "@/components/auth/auth-shell";
import { redirectIfAuthenticated } from "@/lib/auth";

export const dynamic = "force-dynamic";

type LoginPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  await redirectIfAuthenticated();
  const { error } = await searchParams;

  return (
    <AuthShell
      title="登录新工作台"
      description="这套前端已经独立于后端页面运行，但继续复用你现有的登录态和业务 API。"
      footer={
        <p>
          还没有账号？
          <Link href="/register" className="ml-1 text-app-accent transition hover:text-app-text-strong">
            使用注册码注册
          </Link>
        </p>
      }
    >
      <form className="space-y-5" method="post" action="/api/auth/login?redirect=1">
        <div className="space-y-2">
          <label className="text-sm font-medium text-app-text-soft">用户名</label>
          <input type="text" name="username" required autoComplete="username" placeholder="请输入用户名" className="app-input" />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-app-text-soft">密码</label>
          <input type="password" name="password" required autoComplete="current-password" placeholder="请输入密码" className="app-input" />
        </div>

        {error ? <p className="rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">{error}</p> : null}

        <button type="submit" className="app-button app-button-primary w-full justify-center">
          登录并进入控制台
        </button>
      </form>
    </AuthShell>
  );
}
