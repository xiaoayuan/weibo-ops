import Link from "next/link";

type LoginPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { error } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-slate-900">登录</h1>
          <p className="mt-2 text-sm text-slate-500">登录微博运营后台管理系统</p>
        </div>

        <form className="space-y-5" method="post" action="/api/auth/login?redirect=1">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">用户名</label>
            <input
              type="text"
              name="username"
              required
              autoComplete="username"
              placeholder="请输入用户名"
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-slate-400"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">密码</label>
            <input
              type="password"
              name="password"
              required
              autoComplete="current-password"
              placeholder="请输入密码"
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-slate-400"
            />
          </div>

          {error ? <p className="text-sm text-rose-600">{error}</p> : null}

          <button
            type="submit"
            className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            登录
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-slate-500">
          还没有账号？
          <Link href="/register" className="ml-1 text-sky-700 hover:text-sky-800">
            使用注册码注册
          </Link>
        </p>
      </div>
    </main>
  );
}
