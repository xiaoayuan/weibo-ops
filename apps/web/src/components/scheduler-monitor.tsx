import type { TaskSchedulerStatus } from "@/lib/app-data";
import { SectionHeader } from "@/components/section-header";
import { TableShell } from "@/components/table-shell";
import { formatDateTime } from "@/lib/date";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { SurfaceCard } from "@/components/surface-card";

function renderLabels(labels: string[]) {
  if (labels.length === 0) {
    return <span className="text-app-text-soft">-</span>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {labels.map((label) => (
        <span key={label} className="app-chip">
          {label}
        </span>
      ))}
    </div>
  );
}

export function SchedulerMonitor({ data }: { data: TaskSchedulerStatus | null }) {
  if (!data) {
    return (
      <div className="space-y-6 lg:space-y-8">
        <PageHeader eyebrow="调度快照" title="暂无调度数据" description="当前没有可用的调度队列数据，请检查后端服务状态。" />
        <EmptyState title="暂无调度快照" description="稍后刷新页面，或先让系统产生一些调度任务后再查看。" />
      </div>
    );
  }

  const runningCount = data.workers.reduce(
    (sum, worker) => sum + worker.users.reduce((userSum, user) => userSum + user.runningCount, 0),
    0,
  );
  const pendingCount = data.workers.reduce(
    (sum, worker) => sum + worker.users.reduce((userSum, user) => userSum + user.pendingCount, 0),
    0,
  );

  return (
    <div className="space-y-6 lg:space-y-8">
      <PageHeader eyebrow="调度快照" title="查看 worker、用户队列和限流快照" description="这页先把调度系统最关键的三层信息迁过来：worker 负载、用户并发队列，以及当前限流和延后决策。" />

      <section className="grid gap-4 md:grid-cols-4">
        <SurfaceCard className="rounded-[20px] p-5"><p className="text-xs uppercase tracking-[0.18em] text-app-text-soft">Worker 数量</p><p className="mt-4 text-3xl font-semibold tracking-[-0.05em] text-app-text-strong">{data.workerCount}</p></SurfaceCard>
        <SurfaceCard className="rounded-[20px] p-5"><p className="text-xs uppercase tracking-[0.18em] text-app-text-soft">用户队列</p><p className="mt-4 text-3xl font-semibold tracking-[-0.05em] text-app-text-strong">{data.workers.reduce((sum, worker) => sum + worker.queueCount, 0)}</p></SurfaceCard>
        <SurfaceCard className="rounded-[20px] p-5"><p className="text-xs uppercase tracking-[0.18em] text-app-text-soft">运行中任务</p><p className="mt-4 text-3xl font-semibold tracking-[-0.05em] text-app-text-strong">{runningCount}</p></SurfaceCard>
        <SurfaceCard className="rounded-[20px] p-5"><p className="text-xs uppercase tracking-[0.18em] text-app-text-soft">等待中任务</p><p className="mt-4 text-3xl font-semibold tracking-[-0.05em] text-app-text-strong">{pendingCount}</p></SurfaceCard>
      </section>

      <SurfaceCard>
        <p className="text-sm text-app-text-muted">最近更新时间：{formatDateTime(data.updatedAt)}</p>
      </SurfaceCard>

      <div className="grid gap-6 xl:grid-cols-2">
        {data.workers.map((worker) => (
          <SurfaceCard key={worker.workerId}>
            <div>
              <h2 className="text-xl font-semibold tracking-[-0.03em] text-app-text-strong">{worker.workerId}</h2>
              <p className="mt-2 text-sm text-app-text-muted">当前挂载用户队列：{worker.queueCount}</p>
            </div>

            {worker.users.length === 0 ? (
              <div className="mt-5">
                <EmptyState title="当前 worker 暂无可见用户队列" description="这个 worker 现在没有分配到当前用户可见的运行队列。" />
              </div>
            ) : (
              <div className="mt-5 space-y-4">
                {worker.users.map((user) => (
                  <div key={user.userId} className="rounded-[18px] border border-app-line bg-app-panel-muted p-4">
                    <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                      <div>
                        <p className="font-medium text-app-text-strong">{user.username || "未知用户"}</p>
                        <p className="mt-1 text-xs text-app-text-soft">{user.userId}</p>
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-sm text-app-text-muted">
                        <div>
                          <p className="text-xs text-app-text-soft">并发数</p>
                          <p className="mt-1 font-medium text-app-text-strong">{user.taskConcurrency}</p>
                        </div>
                        <div>
                          <p className="text-xs text-app-text-soft">运行中</p>
                          <p className="mt-1 font-medium text-app-text-strong">{user.runningCount}</p>
                        </div>
                        <div>
                          <p className="text-xs text-app-text-soft">等待中</p>
                          <p className="mt-1 font-medium text-app-text-strong">{user.pendingCount}</p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 space-y-3">
                      <div>
                        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-app-text-soft">Running</p>
                        {renderLabels(user.runningLabels)}
                      </div>
                      <div>
                        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-app-text-soft">Pending</p>
                        {renderLabels(user.pendingLabels)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SurfaceCard>
        ))}
      </div>

      <SurfaceCard>
        <SectionHeader title="限流与延后决策" description="这一块展示当前调度器为不同任务类型做出的延后和档位决策。" />

        {data.rateLimit.users.length === 0 && data.rateLimit.taskTypes.length === 0 ? (
          <div className="mt-5">
            <EmptyState title="当前没有限流快照" description="说明最近没有产生需要延后的任务，或当前用户还没有命中限流窗口。" />
          </div>
        ) : (
          <TableShell className="mt-5">
            <table className="app-table min-w-[1080px]">
              <thead>
                <tr>
                  <th>维度</th>
                  <th>任务类型</th>
                  <th>延后</th>
                  <th>最早可用时间</th>
                  <th>状态</th>
                </tr>
              </thead>
              <tbody>
                {data.rateLimit.taskTypes.map((item) => (
                  <tr key={`task-type-${item.taskType}`}>
                    <td className="text-xs text-app-text-soft">任务类型</td>
                    <td>{item.taskType}</td>
                    <td>{item.waitMs <= 0 ? "未延后" : `${Math.ceil(item.waitMs / 1000)} 秒`}</td>
                    <td>{item.nextAvailableAt ? formatDateTime(item.nextAvailableAt) : "-"}</td>
                    <td>{item.active ? "限流中" : "空闲"}</td>
                  </tr>
                ))}
                {data.rateLimit.users.map((item) => (
                  <tr key={`user-${item.userId}`}>
                    <td className="font-mono text-xs text-app-text-soft">{item.username || item.userId}</td>
                    <td>用户级限制</td>
                    <td>{item.waitMs <= 0 ? "未延后" : `${Math.ceil(item.waitMs / 1000)} 秒`}</td>
                    <td>{item.nextAvailableAt ? formatDateTime(item.nextAvailableAt) : "-"}</td>
                    <td>{item.active ? "限流中" : "空闲"}</td>
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
