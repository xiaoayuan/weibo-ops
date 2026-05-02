import type { TrafficSummary } from "@/lib/app-data";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { SectionHeader } from "@/components/section-header";
import { SurfaceCard } from "@/components/surface-card";
import { TableShell } from "@/components/table-shell";
import { getActionTypeText } from "@/lib/text";

function toNumber(value: bigint | number | string | null | undefined) {
  if (value === null || value === undefined) {
    return 0;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === "bigint") {
    return Number(value);
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatBytes(bytes: number) {
  if (bytes <= 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let index = 0;

  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }

  const digits = value >= 100 ? 0 : value >= 10 ? 1 : 2;
  return `${value.toFixed(digits)} ${units[index]}`;
}

export function TrafficPanel({ data }: { data: TrafficSummary | null }) {
  if (!data) {
    return (
      <div className="space-y-6 lg:space-y-8">
        <PageHeader title="暂无流量数据" description="当前没有可用的流量统计数据，请检查执行日志。" />
        <EmptyState title="暂无流量数据" description="等真实执行日志继续沉淀后，这里会展示动作占比、日趋势和最近流量明细。" />
      </div>
    );
  }

  const dailyTrend = [...data.dailyRows].reverse();

  return (
    <div className="space-y-6 lg:space-y-8">
      <PageHeader title="流量消耗与动作统计" description="查看近期流量消耗、动作占比和执行明细。" />

      <section className="grid gap-4 md:grid-cols-3">
        <SurfaceCard className="rounded-[20px] p-5"><p className="text-xs uppercase tracking-[0.18em] text-app-text-soft">近 24 小时</p><p className="mt-4 text-3xl font-semibold tracking-[-0.05em] text-app-text-strong">{formatBytes(toNumber(data.oneDayBytes))}</p></SurfaceCard>
        <SurfaceCard className="rounded-[20px] p-5"><p className="text-xs uppercase tracking-[0.18em] text-app-text-soft">近 7 天</p><p className="mt-4 text-3xl font-semibold tracking-[-0.05em] text-app-text-strong">{formatBytes(toNumber(data.sevenDayBytes))}</p></SurfaceCard>
        <SurfaceCard className="rounded-[20px] p-5"><p className="text-xs uppercase tracking-[0.18em] text-app-text-soft">近 30 天</p><p className="mt-4 text-3xl font-semibold tracking-[-0.05em] text-app-text-strong">{formatBytes(toNumber(data.thirtyDayBytes))}</p></SurfaceCard>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <SurfaceCard>
          <SectionHeader title="动作流量占比（近 7 天）" />
          <div className="mt-5 space-y-3">
            {data.actionRows.length === 0 ? (
              <p className="text-sm text-app-text-muted">暂无流量数据</p>
            ) : (
              data.actionRows.map((item) => (
                <div key={item.actionKey} className="flex items-center justify-between gap-4 rounded-[16px] border border-app-line bg-app-panel-muted px-4 py-3 text-sm">
                  <div className="text-app-text">{getActionTypeText(item.actionKey)}（{item.logCount} 次）</div>
                  <div className="font-medium text-app-text-strong">{formatBytes(toNumber(item.bytes))}</div>
                </div>
              ))
            )}
          </div>
        </SurfaceCard>

        <SurfaceCard>
          <SectionHeader title="日趋势（近 14 天）" />
          <div className="mt-5 space-y-3">
            {dailyTrend.length === 0 ? (
              <p className="text-sm text-app-text-muted">暂无流量数据</p>
            ) : (
              dailyTrend.map((item) => (
                <div key={item.day} className="flex items-center justify-between gap-4 rounded-[16px] border border-app-line bg-app-panel-muted px-4 py-3 text-sm">
                  <div className="text-app-text-muted">{item.day}</div>
                  <div className="font-medium text-app-text-strong">{formatBytes(toNumber(item.bytes))}</div>
                </div>
              ))
            )}
          </div>
        </SurfaceCard>
      </section>

      <SurfaceCard>
        <SectionHeader title="最近流量明细（近 7 天）" />
        {data.recentRows.length === 0 ? (
          <div className="mt-5">
            <EmptyState title="暂无流量明细" description="当前近 7 天里没有记录到有效流量数据。" />
          </div>
        ) : (
          <TableShell className="mt-5">
            <table className="app-table min-w-[980px]">
              <thead>
                <tr>
                  <th>时间</th>
                  <th>账号</th>
                  <th>动作</th>
                  <th>流量</th>
                </tr>
              </thead>
              <tbody>
                {data.recentRows.map((item) => (
                  <tr key={item.id}>
                    <td>{new Date(item.executedAt).toLocaleString("zh-CN")}</td>
                    <td>{item.accountNickname}</td>
                    <td>{getActionTypeText(item.actionKey)}</td>
                    <td>{formatBytes(toNumber(item.bytes))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableShell>
        )}
      </SurfaceCard>
    </div>
  );
}
