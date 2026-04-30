import { AlertTriangle, Clock3, DatabaseZap } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import { SurfaceCard } from "@/components/surface-card";
import { getLogs } from "@/lib/app-data";
import { formatDateTime } from "@/lib/date";
import { getActionTypeText } from "@/lib/text";
import { requireSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function LogsPage() {
  await requireSession();

  const logs = await getLogs();
  const failedCount = logs.filter((log) => !log.success).length;
  const successCount = logs.length - failedCount;

  return (
    <div className="space-y-6 lg:space-y-8">
      <PageHeader
        eyebrow="可观测性"
        title="执行日志先在新前端读通"
        description="日志页的价值在于快速看清最近执行了什么、哪里失败了、失败影响到谁。当前先迁移最近 50 条日志视图。"
      />

      <section className="grid gap-4 md:grid-cols-3">
        <StatCard label="最近日志" value={String(logs.length)} detail="当前后端接口默认返回最近 50 条" accent="info" icon={<Clock3 className="h-5 w-5" />} />
        <StatCard label="成功记录" value={String(successCount)} detail="执行成功或状态更新" accent="success" icon={<DatabaseZap className="h-5 w-5" />} />
        <StatCard label="失败记录" value={String(failedCount)} detail="建议优先继续下钻失败详情" accent="danger" icon={<AlertTriangle className="h-5 w-5" />} />
      </section>

      <SurfaceCard>
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-app-text-strong">最近 50 条执行日志</h2>
            <p className="mt-2 text-sm text-app-text-muted">后续会继续加筛选、用户维度、动作类型过滤和错误归类色彩。</p>
          </div>
          <StatusBadge tone={failedCount > 0 ? "warning" : "success"}>{failedCount > 0 ? `含 ${failedCount} 条失败` : "全部成功"}</StatusBadge>
        </div>

        {logs.length === 0 ? (
          <div className="mt-5">
            <EmptyState title="暂无日志" description="当后端执行链路开始写入更多日志后，这里会继续补充筛选、定位和详情交互。" />
          </div>
        ) : (
          <div className="mt-5 overflow-x-auto rounded-[24px] border border-app-line">
            <table className="app-table">
              <thead>
                <tr>
                  <th>时间</th>
                  <th>动作</th>
                  <th>账号</th>
                  <th>结果</th>
                  <th>说明</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td className="font-mono text-xs text-app-text-soft">{formatDateTime(log.executedAt)}</td>
                    <td className="text-app-text-strong">{getActionTypeText(log.actionType)}</td>
                    <td>{log.account?.nickname || "系统"}</td>
                    <td>
                      <StatusBadge tone={log.success ? "success" : "danger"}>{log.success ? "成功" : "失败"}</StatusBadge>
                    </td>
                    <td className="max-w-[360px] text-xs leading-6 text-app-text-soft">{log.errorMessage || (log.success ? "执行成功，无额外错误信息。" : "未返回错误详情。")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SurfaceCard>
    </div>
  );
}
