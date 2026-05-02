"use client";

import { LoaderCircle, Trash2 } from "lucide-react";
import { useState } from "react";

import { AppNotice } from "@/components/app-notice";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { SectionHeader } from "@/components/section-header";
import { StatusBadge } from "@/components/status-badge";
import { SurfaceCard } from "@/components/surface-card";
import { TableShell } from "@/components/table-shell";
import type { CommentPoolItem } from "@/lib/app-data";
import { formatDateTime } from "@/lib/date";
import { readJsonResponse } from "@/lib/http";

type PoolListResponse = {
  success: boolean;
  message?: string;
  data: CommentPoolItem[];
};

type BatchImportResponse = {
  success: boolean;
  message?: string;
  data?: {
    imported: string[];
    skipped: Array<{ url: string; reason: string }>;
  };
};

type DeleteResponse = {
  success: boolean;
  message?: string;
};

export function CommentPoolManager({ initialItems }: { initialItems: CommentPoolItem[] }) {
  const [items, setItems] = useState(initialItems);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [batchText, setBatchText] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [apiMissing, setApiMissing] = useState(false);

  const stats = {
    total: items.length,
    tagged: items.filter((item) => item.tags.length > 0).length,
    duplicate: items.filter((item) => item.isForcedDuplicate).length,
  };

  async function refreshList() {
    if (apiMissing) return;

    try {
      setLoading(true);
      setError(null);

      const response = await fetch("/api/comment-pool", { cache: "no-store" });

      if (response.status === 404) {
        setApiMissing(true);
        setError("接口不存在，跳过");
        return;
      }

      const result = await readJsonResponse<PoolListResponse>(response);

      if (!response.ok) {
        throw new Error(result.message || "刷新列表失败");
      }

      setItems(result.data);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "刷新列表失败");
    } finally {
      setLoading(false);
    }
  }

  async function batchImport() {
    if (apiMissing) return;

    const links = batchText
      .split(/\n+/)
      .map((item) => item.trim())
      .filter(Boolean);

    if (links.length === 0) {
      setError("请先粘贴至少一条链接");
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      setNotice(null);

      const response = await fetch("/api/comment-pool/batch-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceUrls: links }),
      });

      if (response.status === 404) {
        setApiMissing(true);
        setError("接口不存在，跳过");
        return;
      }

      const result = await readJsonResponse<BatchImportResponse>(response);

      if (!response.ok) {
        throw new Error(result.message || "批量导入失败");
      }

      await refreshList();
      setBatchText("");

      const importedCount = result.data?.imported.length ?? 0;
      const skippedCount = result.data?.skipped.length ?? 0;

      if (skippedCount > 0) {
        setError(`导入完成：成功 ${importedCount} 条，跳过 ${skippedCount} 条`);
      } else {
        setNotice(`成功导入 ${importedCount} 条评论链接`);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "批量导入失败");
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteItem(id: string) {
    if (apiMissing) return;

    if (!window.confirm("确认删除这条评论链接吗？")) {
      return;
    }

    try {
      setDeletingId(id);
      setError(null);

      const response = await fetch(`/api/comment-pool/${id}`, { method: "DELETE" });

      if (response.status === 404) {
        setApiMissing(true);
        setError("接口不存在，跳过");
        return;
      }

      const result = await readJsonResponse<DeleteResponse>(response);

      if (!response.ok) {
        throw new Error(result.message || "删除失败");
      }

      setItems((current) => current.filter((item) => item.id !== id));
      setNotice(result.message || "删除成功");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "删除失败");
    } finally {
      setDeletingId(null);
    }
  }

  async function batchDeleteItems() {
    if (selectedIds.length === 0) {
      setError("请先选择至少一条评论链接");
      return;
    }

    if (!window.confirm(`确认删除选中的 ${selectedIds.length} 条评论链接吗？`)) {
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      setNotice(null);

      for (const id of selectedIds) {
        const response = await fetch(`/api/comment-pool/${id}`, { method: "DELETE" });
        if (response.status === 404) {
          setApiMissing(true);
          throw new Error("接口不存在，跳过");
        }

        const result = await readJsonResponse<DeleteResponse>(response);
        if (!response.ok) {
          throw new Error(result.message || `删除 ${id} 失败`);
        }
      }

      setItems((current) => current.filter((item) => !selectedIds.includes(item.id)));
      setNotice(`已删除 ${selectedIds.length} 条评论链接`);
      setSelectedIds([]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "批量删除失败");
    } finally {
      setSubmitting(false);
    }
  }

  function renderList() {
    if (items.length === 0) {
      return <EmptyState title="暂无评论链接" description="批量导入评论链接或从热评提取补充评论池。" />;
    }

    return (
      <TableShell className="mt-5">
        <table className="app-table min-w-[1000px]">
          <thead>
            <tr>
              <th>选择</th>
              <th>评论链接</th>
              <th>评论 ID</th>
              <th>标签</th>
              <th>状态</th>
              <th>创建时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(item.id)}
                    onChange={() =>
                      setSelectedIds((current) =>
                        current.includes(item.id) ? current.filter((selectedId) => selectedId !== item.id) : [...current, item.id],
                      )
                    }
                  />
                </td>
                <td className="max-w-[320px]">
                  <a
                    href={item.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-app-accent underline underline-offset-2 hover:text-app-accent/70"
                  >
                    {item.sourceUrl}
                  </a>
                </td>
                <td className="font-mono text-xs text-app-text-soft">{item.commentId}</td>
                <td>
                  <div className="flex flex-wrap gap-1">
                    {item.tags.length === 0 ? (
                      <span className="text-xs text-app-text-soft">-</span>
                    ) : (
                      item.tags.map((tag) => (
                        <StatusBadge key={tag} tone="accent">
                          {tag}
                        </StatusBadge>
                      ))
                    )}
                  </div>
                </td>
                <td>
                  {item.isForcedDuplicate ? (
                    <StatusBadge tone="warning">重复</StatusBadge>
                  ) : (
                    <StatusBadge tone="success">正常</StatusBadge>
                  )}
                </td>
                <td className="text-xs text-app-text-soft">{item.createdAt ? formatDateTime(item.createdAt) : "-"}</td>
                <td>
                  <button
                    type="button"
                    onClick={() => void deleteItem(item.id)}
                    disabled={deletingId === item.id}
                    className="app-button app-button-secondary h-9 px-4 text-xs text-app-danger hover:border-app-danger/30 hover:text-app-danger"
                  >
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                    {deletingId === item.id ? "删除中" : "删除"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableShell>
    );
  }

  return (
    <div className="space-y-6 lg:space-y-8">
      <PageHeader
        title="评论池管理"
        description="从微博评论链接批量导入到评论池，支持热评提取，为互动任务提供数据基础。"
      />

      <section className="grid gap-4 md:grid-cols-3">
        <SurfaceCard className="rounded-[20px] p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-app-text-soft">评论总数</p>
          <p className="mt-4 text-3xl font-semibold tracking-[-0.05em] text-app-text-strong">{stats.total}</p>
        </SurfaceCard>
        <SurfaceCard className="rounded-[20px] p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-app-text-soft">已打标签</p>
          <p className="mt-4 text-3xl font-semibold tracking-[-0.05em] text-app-text-strong">{stats.tagged}</p>
        </SurfaceCard>
        <SurfaceCard className="rounded-[20px] p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-app-text-soft">强制重复</p>
          <p className="mt-4 text-3xl font-semibold tracking-[-0.05em] text-app-text-strong">{stats.duplicate}</p>
        </SurfaceCard>
      </section>

      <SurfaceCard>
        <SectionHeader
          title="批量导入"
          description="每行一条评论链接，系统自动识别评论 ID。"
          action={
            <button
              type="button"
              onClick={() => void batchImport()}
              disabled={submitting}
              className="app-button app-button-primary"
            >
              {submitting ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
              {submitting ? "导入中" : "导入"}
            </button>
          }
        />
        <div className="mt-4">
          <textarea
            value={batchText}
            onChange={(event) => setBatchText(event.target.value)}
            className="app-input min-h-[160px] w-full resize-y py-3"
            placeholder="粘贴评论链接，每行一条，例如：&#10;https://weibo.cn/comment/HABCDEFGH&#10;https://weibo.cn/comment/IJKLMNOPQ"
          />
        </div>

        {error ? <AppNotice tone="error" className="mt-4">{error}</AppNotice> : null}
        {notice ? <AppNotice tone="success" className="mt-4">{notice}</AppNotice> : null}
      </SurfaceCard>

      <SurfaceCard>
        <SectionHeader
          title="评论池列表"
          description={`共 ${items.length} 条评论链接，支持按链接和 ID 搜索。`}
          action={
            <div className="flex gap-3">
              <button type="button" onClick={() => void batchDeleteItems()} disabled={submitting || selectedIds.length === 0} className="app-button app-button-secondary text-app-danger hover:border-app-danger/30 hover:text-app-danger">
                批量删除
              </button>
              <button
                type="button"
                onClick={() => void refreshList()}
                disabled={loading}
                className="app-button app-button-secondary"
              >
                {loading ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
                {loading ? "刷新中" : "刷新"}
              </button>
            </div>
          }
        />

        {apiMissing ? (
          <AppNotice tone="info" className="mt-4">接口不存在，跳过。</AppNotice>
        ) : (
          renderList()
        )}
      </SurfaceCard>
    </div>
  );
}
