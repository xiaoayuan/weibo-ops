import { requireSession } from "@/lib/auth";
import { PlaceholderModule } from "@/components/placeholder-module";
import { SurfaceCard } from "@/components/surface-card";
import { StatusBadge } from "@/components/status-badge";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await requireSession();

  return (
    <div className="space-y-6 lg:space-y-8">
      <SurfaceCard className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm text-app-text-muted">当前登录用户</p>
          <h1 className="mt-2 text-3xl font-semibold text-app-text-strong">{session.username}</h1>
          <p className="mt-3 text-sm text-app-text-muted">系统设置页后续会接个人资料、风险规则、执行策略和邀请码管理。</p>
        </div>
        <StatusBadge tone="accent">{session.role}</StatusBadge>
      </SurfaceCard>

      <PlaceholderModule title="系统设置" description="这里会成为配置页模板的代表页，后续所有表单型模块都会共享这一套结构和风格。" />
    </div>
  );
}
