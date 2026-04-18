export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">系统设置</h2>
        <p className="mt-1 text-sm text-slate-500">当前先保留为项目基础参数说明，后续可接入权限和通知设置。</p>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="space-y-4 text-sm text-slate-600">
          <p>1. 数据库连接通过 `.env` 中的 `DATABASE_URL` 配置。</p>
          <p>2. 登录鉴权预留了 `JWT_SECRET` 配置，后续可接入真实登录流程。</p>
          <p>3. 当前计划页、互动页和日志页都已具备基础数据流，可继续扩展审批、告警和角色权限。</p>
        </div>
      </section>
    </div>
  );
}
