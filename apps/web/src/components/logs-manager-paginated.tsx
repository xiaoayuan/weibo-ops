"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { AppNotice } from "@/components/app-notice";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { SectionHeader } from "@/components/section-header";
import { StatusBadge } from "@/components/status-badge";
import { SurfaceCard } from "@/components/surface-card";
import { TableShell } from "@/components/table-shell";
import { Pagination } from "@/components/pagination";
import { TableSkeleton } from "@/components/skeleton";
import { usePaginatedData } from "@/lib/api/use-paginated-data";
import type { ExecutionLog } from "@/lib/app-data";
import { formatDateTime } from "@/lib/date";

export function LogsManagerPaginated() {
  const {
    data: logs,
    pagination,
    loading,
    error,
    fetchData,
    goToPage,
    changePageSize,
    refresh,
  } = usePaginatedData<ExecutionLog>("/api/logs", 50);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div className="space-y-6 lg:space-y-8">
      <PageHeader
        title="执行日志"
        description="查看所有账号的执行记录和结果。"
        action={
          <button
            type="button"
            onClick={refresh}
            disabled={loading}
            className="app-button app-button-secondary"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            刷新
          </button>
        }
      />

      {error && <AppNotice tone="error">{error}</AppNotice>}

      <SurfaceCard>
        <SectionHeader
          title="日志列表"
          description={`共 ${pagination.total} 条记录`}
        />

        {loading && !logs.length ? (
          <div className="mt-5">
            <TableSkeleton rows={10} columns={6} />
          </div>
        ) : logs.length === 0 ? (
          <div className="mt-5">
            <EmptyState title="暂无日志" description="还没有执行记录。" />
          </div>
        ) : (
          <>
            <TableShell className="mt-5">
              <table className="app-table min-w-[1200px]">
                <thead>
                  <tr>
                    <th>执行时间</th>
                    <th>账号</th>
                    <th>操作类型</th>
                    <th>状态</th>
                    <th>错误信息</th>
                    <th>详情</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id}>
                      <td className="text-sm text-app-text-muted">
                        {formatDateTime(log.executedAt)}
                      </td>
                      <td>
                        {log.account ? (
                          <div>
                            <div className="font-medium text-app-text-strong">
                              {log.account.nickname}
                            </div>
                            <div className="text-xs text-app-text-soft">
                              {log.account.id.slice(0, 8)}
                            </div>
                          </div>
                        ) : (
                          <span className="text-app-text-soft">-</span>
                        )}
                      </td>
                      <td>
                        <span className="app-chip">{log.actionType}</span>
                      </td>
                      <td>
                        <StatusBadge tone={log.success ? "success" : "danger"}>
                          {log.success ? "成功" : "失败"}
                        </StatusBadge>
                      </td>
                      <td className="max-w-[300px]">
                        {log.errorMessage ? (
                          <span className="text-sm text-app-danger">
                            {log.errorMessage}
                          </span>
                        ) : (
                          <span className="text-app-text-soft">-</span>
                        )}
                      </td>
                      <td>
                        {log.plan ? (
                          <span className="text-xs text-app-text-soft">
                            计划 ID: {log.plan.id.slice(0, 8)}
                          </span>
                        ) : (
                          <span className="text-app-text-soft">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableShell>

            <Pagination
              pagination={pagination}
              onPageChange={goToPage}
              onPageSizeChange={changePageSize}
            />
          </>
        )}
      </SurfaceCard>
    </div>
  );
}
