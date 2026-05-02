import Link from "next/link";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { SurfaceCard } from "@/components/surface-card";

export function PlaceholderModule({ title, description }: { title: string; description: string }) {
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="迁移中" title={title} description={description} />

      <SurfaceCard className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <h2 className="text-xl font-semibold tracking-[-0.03em] text-app-text-strong">这一页已经切入新壳层</h2>
          <p className="mt-3 text-sm leading-7 text-app-text-muted">
            当前模块已经使用新的前端导航、主题系统和卡片语言，但具体业务交互仍在逐步迁移。这里不代表后端未接入，而是该页面的完整操作流还在补齐中。
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <span className="app-chip">深色主视觉已就位</span>
            <span className="app-chip">浅色主题可切换</span>
            <span className="app-chip">准备接入独立 API 流程</span>
          </div>
        </div>
        <div className="rounded-[18px] border border-app-line bg-app-panel-muted p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-app-text-soft">迁移建议</p>
          <ul className="mt-4 space-y-3 text-sm text-app-text-muted">
            <li>先接入这个模块的列表读取接口。</li>
            <li>再迁移新增、编辑、删除和批量动作。</li>
            <li>最后补齐更细的状态反馈和空态文案。</li>
          </ul>
          <Link href="/" className="mt-6 inline-flex text-sm text-app-accent-strong transition hover:text-app-text-strong">
            返回控制台查看整体进度
          </Link>
        </div>
      </SurfaceCard>

      <EmptyState title="功能开发中" description="该模块正在开发中，敬请期待。" />
    </div>
  );
}
