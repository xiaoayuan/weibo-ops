"use client";

import { CheckCircle, LoaderCircle, Trash2 } from "lucide-react";
import { useState } from "react";

import { AppNotice } from "@/components/app-notice";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { SectionHeader } from "@/components/section-header";
import { StatusBadge } from "@/components/status-badge";
import { SurfaceCard } from "@/components/surface-card";
import { TableShell } from "@/components/table-shell";
import type { CommentPoolItem } from "@/lib/app-data";
import { readJsonResponse } from "@/lib/http";

type HotComment = {
  commentId: string;
  sourceUrl: string;
  text: string;
  author: string;
  likeCount?: number;
};

type HotCommentsResponse = {
  success: boolean;
  message?: string;
  data?: {
    statusId: string;
    items: HotComment[];
  };
};

type BatchImportResponse = {
  success: boolean;
  message?: string;
  data?: {
    imported: string[];
    skipped: Array<{ url: string; reason: string }>;
  };
};

export function HotCommentsExtractor({ onImported }: { onImported?: (items: CommentPoolItem[]) => void }) {
  const [targetUrl, setTargetUrl] = useState("");
  const [maxItems, setMaxItems] = useState(20);
  const [keywords, setKeywords] = useState("");
  const [items, setItems] = useState<HotComment[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [statusId, setStatusId] = useState<string | null>(null);

  async function fetchHotComments() {
    if (!targetUrl.trim()) {
      setError("请输入微博链接");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setNotice(null);
      setItems([]);
      setSelectedIds([]);

      const response = await fetch("/api/comment-pool/hot-comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetUrl: targetUrl.trim(),
          limit: maxItems,
          keywords: keywords
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
        }),
      });

      const result = await readJsonResponse<HotCommentsResponse>(response);

      if (!response.ok) {
        throw new Error(result.message || "提取失败");
      }

      if (!result.data) {
        throw new Error("接口未返回数据");
      }

      setItems(result.data.items);
      setSelectedIds(result.data.items.map((item) => item.commentId));
      setStatusId(result.data.statusId);
      setNotice(`已提取 ${result.data.items.length} 条热评，微博 ID：${result.data.statusId}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "提取失败");
    } finally {
      setLoading(false);
    }
  }

  async function importSelected() {
    const selected = items.filter((item) => selectedIds.includes(item.commentId));

    if (selected.length === 0) {
      setError("请至少选择一条评论");
      return;
    }

    try {
      setImporting(true);
      setError(null);
      setNotice(null);

      const response = await fetch("/api/comment-pool/batch-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceUrls: selected.map((item) => item.sourceUrl),
        }),
      });

      const result = await readJsonResponse<BatchImportResponse>(response);

      if (!response.ok) {
        throw new Error(result.message || "导入失败");
      }

      const importedCount = result.data?.imported.length ?? 0;
      const skippedCount = result.data?.skipped.length ?? 0;

      if (skippedCount > 0) {
        setNotice(`导入完成：成功 ${importedCount} 条，跳过 ${skippedCount} 条（已存在）`);
      } else {
        setNotice(`成功导入 ${importedCount} 条评论到评论池`);
      }

      setItems((current) => current.filter((item) => !selectedIds.includes(item.commentId)));
      setSelectedIds([]);

      if (onImported) {
        onImported([]);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "导入失败");
    } finally {
      setImporting(false);
    }
  }

  function toggleSelect(commentId: string) {
    setSelectedIds((current) =>
      current.includes(commentId) ? current.filter((id) => id !== commentId) : [...current, commentId],
    );
  }

  function selectAll() {
    setSelectedIds(items.map((item) => item.commentId));
  }

  function clearSelection() {
    setSelectedIds([]);
  }

  return (
    <div className="space-y-6 lg:space-y-8">
      <PageHeader
        eyebrow="热评提取"
        title="从微博提取热门评论"
        description="输入目标微博链接，提取热门评论，筛选后批量导入评论池，为互动任务提供评论素材。"
      />

      <SurfaceCard>
        <SectionHeader
          title="提取配置"
          description="填写目标微博链接和筛选条件。"
          action={
            <button
              type="button"
              onClick={() => void fetchHotComments()}
              disabled={loading}
              className="app-button app-button-primary"
            >
              {loading ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
              {loading ? "提取中" : "提取热评"}
            </button>
          }
        />

        <div className="mt-4 space-y-4">
          <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-app-text-soft">
              目标微博链接
            </label>
            <input
              value={targetUrl}
              onChange={(event) => setTargetUrl(event.target.value)}
              className="app-input w-full py-2.5"
              placeholder="https://m.weibo.cn/detail/4986058227009148"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-app-text-soft">
                最大条数
              </label>
              <input
                type="number"
                value={maxItems}
                onChange={(event) => setMaxItems(Math.max(1, Math.min(100, Number(event.target.value) || 20)))}
                className="app-input w-full py-2.5"
                min={1}
                max={100}
              />
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-app-text-soft">
                关键词筛选（可选，逗号分隔）
              </label>
              <input
                value={keywords}
                onChange={(event) => setKeywords(event.target.value)}
                className="app-input w-full py-2.5"
                placeholder="不错,支持,加油"
              />
            </div>
          </div>
        </div>

        {error ? <AppNotice tone="error" className="mt-4">{error}</AppNotice> : null}
        {notice ? <AppNotice tone="success" className="mt-4">{notice}</AppNotice> : null}
      </SurfaceCard>

      <SurfaceCard>
        <SectionHeader
          title="提取结果"
          description={
            items.length === 0
              ? "暂无数据，配置参数后点击“提取热评”。"
              : `已提取 ${items.length} 条，已选 ${selectedIds.length} 条`
          }
          action={
            items.length > 0 ? (
              <div className="flex items-center gap-2">
                <button type="button" onClick={selectAll} className="app-button app-button-secondary">
                  全选
                </button>
                <button type="button" onClick={clearSelection} className="app-button app-button-secondary">
                  清空选择
                </button>
                <button
                  type="button"
                  onClick={() => void importSelected()}
                  disabled={importing || selectedIds.length === 0}
                  className="app-button app-button-primary"
                >
                  {importing ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {importing ? "导入中" : `导入 ${selectedIds.length} 条到评论池`}
                </button>
              </div>
            ) : null
          }
        />

        {statusId ? (
          <div className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-app-border px-3 py-1 text-xs text-app-text-soft">
            <CheckCircle className="h-3.5 w-3.5 text-app-success" />
            微博 ID：{statusId}
          </div>
        ) : null}

        {items.length === 0 ? (
          <EmptyState title="暂无热评数据" description="请先配置参数并点击“提取热评”。" />
        ) : (
          <TableShell className="mt-5">
            <table className="app-table min-w-[800px]">
              <thead>
                <tr>
                  <th className="w-12">选择</th>
                  <th className="w-20">作者</th>
                  <th>评论内容</th>
                  <th className="w-24">点赞数</th>
                  <th className="w-32">评论 ID</th>
                  <th className="w-16">操作</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const checked = selectedIds.includes(item.commentId);

                  return (
                    <tr key={item.commentId} className={checked ? "bg-app-accent/[0.03]" : undefined}>
                      <td>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleSelect(item.commentId)}
                          className="app-checkbox"
                        />
                      </td>
                      <td className="text-xs font-medium text-app-text-strong">{item.author}</td>
                      <td>
                        <p className="text-xs leading-relaxed text-app-text">{item.text}</p>
                        <a
                          href={item.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1 inline-block text-[11px] text-app-accent underline underline-offset-2 hover:text-app-accent/70"
                        >
                          原文链接
                        </a>
                      </td>
                      <td>
                        {item.likeCount != null ? (
                          <StatusBadge tone="accent">{item.likeCount.toLocaleString()}</StatusBadge>
                        ) : (
                          <span className="text-xs text-app-text-soft">-</span>
                        )}
                      </td>
                      <td className="font-mono text-xs text-app-text-soft">{item.commentId}</td>
                      <td>
                        <button
                          type="button"
                          onClick={() => toggleSelect(item.commentId)}
                          className="app-button app-button-secondary h-8 px-3 text-[11px]"
                        >
                          {checked ? "取消" : "选择"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableShell>
        )}
      </SurfaceCard>
    </div>
  );
}