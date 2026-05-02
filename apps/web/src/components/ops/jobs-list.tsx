"use client";

import { useState, useMemo } from "react";
import { RefreshCw, Trash2 } from "lucide-react";
import { SectionHeader } from "@/components/section-header";
import { SurfaceCard } from "@/components/surface-card";
import { TableShell } from "@/components/table-shell";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";
import type { ActionJob } from "@/lib/app-data";
import { formatDateTime } from "@/lib/date";
import { getJobTypeText, getJobStatusText } from "./types";

type JobsListProps = {
  jobs: ActionJob[];
  statusFilter: "ALL" | ActionJob["status"];
  onStatusFilterChange: (filter: "ALL" | ActionJob["status"]) => void;
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  onRefresh: () => void;
  onDelete: (ids: string[]) => void;
};

export function JobsList({
  jobs,
  statusFilter,
  onStatusFilterChange,
  selectedIds,
  onSelectionChange,
  onRefresh,
  onDelete,
}: JobsListProps) {
  const [refreshing, setRefreshing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const filteredJobs = useMemo(() => {
    if (statusFilter === "ALL") {
      return jobs;
    }
    return jobs.filter((job) => job.status === statusFilter);
  }, [jobs, statusFilter]);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      onSelectionChange(filteredJobs.map((job) => job.id));
    } else {
      onSelectionChange([]);
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    if (checked) {
      onSelectionChange([...selectedIds, id]);
    } else {
      onSelectionChange(selectedIds.filter((selectedId) => selectedId !== id));
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  };

  const handleDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`确定要删除选中的 ${selectedIds.length} 个任务吗？`)) return;

    setDeleting(true);
    try {
      await onDelete(selectedIds);
      onSelectionChange([]);
    } finally {
      setDeleting(false);
    }
  };

  const allSelected = filteredJobs.length > 0 && selectedIds.length === filteredJobs.length;
  const someSelected = selectedIds.length > 0 && selectedIds.length < filteredJobs.length;

  const getStatusTone = (status: ActionJob["status"]) => {
    switch (status) {
      case "SUCCESS":
        return "success";
      case "RUNNING":
        return "info";
      case "FAILED":
      case "PARTIAL_FAILED":
        return "danger";
      case "CANCELLED":
        return "neutral";
      default:
        return "warning";
    }
  };

  return (
    <SurfaceCard>
      <SectionHeader
        title="任务列表"
        description={`共 ${jobs.length} 个任务${statusFilter !== "ALL" ? `，筛选后 ${filteredJobs.length} 个` : ""}`}
        action={
          <div className="flex items-center gap-3">
            <select
              value={statusFilter}
              onChange={(e) => onStatusFilterChange(e.target.value as typeof statusFilter)}
              className="app-input w-auto"
            >
              <option value="ALL">全部状态</option>
              <option value="PENDING">待执行</option>
              <option value="RUNNING">执行中</option>
              <option value="SUCCESS">成功</option>
              <option value="PARTIAL_FAILED">部分失败</option>
              <option value="FAILED">失败</option>
              <option value="CANCELLED">已取消</option>
            </select>

            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
              className="app-button app-button-secondary"
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              刷新
            </button>

            {selectedIds.length > 0 && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="app-button app-button-danger"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                删除选中 ({selectedIds.length})
              </button>
            )}
          </div>
        }
      />

      {filteredJobs.length === 0 ? (
        <div className="mt-5">
          <EmptyState
            title={statusFilter !== "ALL" ? "未找到匹配的任务" : "暂无任务"}
            description={statusFilter !== "ALL" ? "尝试切换其他状态筛选" : "创建任务后将显示在这里"}
          />
        </div>
      ) : (
        <TableShell className="mt-5">
          <table className="app-table min-w-[1000px]">
            <thead>
              <tr>
                <th className="w-12">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(input) => {
                      if (input) {
                        input.indeterminate = someSelected;
                      }
                    }}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="app-checkbox"
                  />
                </th>
                <th>任务类型</th>
                <th>状态</th>
                <th>创建时间</th>
                <th>创建者</th>
              </tr>
            </thead>
            <tbody>
              {filteredJobs.map((job) => (
                <tr key={job.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(job.id)}
                      onChange={(e) => handleSelectOne(job.id, e.target.checked)}
                      className="app-checkbox"
                    />
                  </td>
                  <td>
                    <span className="app-chip">{getJobTypeText(job.jobType)}</span>
                  </td>
                  <td>
                    <StatusBadge tone={getStatusTone(job.status)}>
                      {getJobStatusText(job.status)}
                    </StatusBadge>
                  </td>
                  <td className="text-sm text-app-text-muted">{formatDateTime(job.createdAt)}</td>
                  <td className="text-sm text-app-text-soft">
                    {job.createdBy || "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableShell>
      )}
    </SurfaceCard>
  );
}
