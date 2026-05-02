"use client";

import { CheckCircle, LoaderCircle, Plus, Trash2 } from "lucide-react";
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

type ParsedTarget = {
  id: string;
  targetUrl: string;
  targetType: string;
  parsedTargetId: string | null;
  status: string;
  createdAt: string | null;
};

type ParseResponse = {
  success: boolean;
  message?: string;
  data?: ParsedTarget;
};

type BatchImportResponse = {
  success: boolean;
  message?: string;
  data?: {
    imported: string[];
    skipped: Array<{ url: string; reason: string }>;
  };
};

export function InteractionTargetParser({ onImported }: { onImported?: (items: CommentPoolItem[]) => void }) {
  const [targetUrl, setTargetUrl] = useState("");
  const [batchText, setBatchText] = useState("");
  const [parsedTargets, setParsedTargets] = useState<ParsedTarget[]>([]);
  const [loading, setLoading] = useState(false);
  const [batchLoading, setBatchLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function parseSingle() {
    if (!targetUrl.trim()) {
      setError("请输入互动目标链接");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setNotice(null);

      const response = await fetch("/api/interaction-targets/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUrl: targetUrl.trim() }),
      });

      const result = await readJsonResponse<ParseResponse>(response);

      if (!response.ok) {
        throw new Error(result.message || "解析失败");
      }

      if (!result.data) {
        throw new Error("接口未返回数据");
      }

      setParsedTargets((current) => [result.data!, ...current.filter((item) => item.id !== result.data!.id)]);
      setTargetUrl("");
      setNotice(`解析成功，目标 ID：${result.data.parsedTargetId || "未知"}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "解析失败");
    } finally {
      setLoading(false);
    }
  }

  async function parseBatch() {
    const links = batchText
      .split(/\n+/)
      .map((item) => item.trim())
      .filter(Boolean);

    if (links.length === 0) {
      setError("请先粘贴至少一条链接");
      return;
    }

    try {
      setBatchLoading(true);
      setError(null);
      setNotice(null);

      let succeeded = 0;
      let failed = 0;
      const newTargets: ParsedTarget[] = [];

      for (const url of links) {
        try {
          const response = await fetch("/api/interaction-targets/parse", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ targetUrl: url }),
          });

          const result = await readJsonResponse<ParseResponse>(response);

          if (response.ok && result.data) {
            newTargets.push(result.data);
            succeeded++;
          } else {
            failed++;
          }
        } catch {
          failed++;
        }
      }

      setParsedTargets((current) => {
        const existingIds = new Set(current.map((item) => item.id));
        const deduplicated = newTargets.filter((item) => !existingIds.has(item.id));
        return [...deduplicated, ...current];
      });

      setBatchText("");

      if (failed > 0) {
        setNotice(`批量解析完成：成功 ${succeeded} 条，失败 ${failed} 条`);
      } else {
        setNotice(`成功解析 ${succeeded} 条互动目标`);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "批量解析失败");
    } finally {
      setBatchLoading(false);
    }
  }

  async function importToCommentPool() {
    if (parsedTargets.length === 0) {
      setError("没有可导入的互动目标");
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
          sourceUrls: parsedTargets.map((item) => item.targetUrl),
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
        setNotice(`成功导入 ${importedCount} 条互动目标到评论池`);
      }

      if (onImported) {
        onImported([]);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "导入评论池失败");
    } finally {
      setImporting(false);
    }
  }

  function removeParsedTarget(id: string) {
    setParsedTargets((current) => current.filter((item) => item.id !== id));
  }

  return (
    <div className="space-y-6 lg:space-y-8">
      <PageHeader
        title="互动目标解析"
        description="解析互动目标链接，提取目标 ID，批量导入评论池，为互动任务提供执行目标。"
      />

      <section className="grid gap-4 md:grid-cols-3">
        <SurfaceCard className="rounded-[20px] p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-app-text-soft">已解析目标</p>
          <p className="mt-4 text-3xl font-semibold tracking-[-0.05em] text-app-text-strong">{parsedTargets.length}</p>
        </SurfaceCard>
        <SurfaceCard className="rounded-[20px] p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-app-text-soft">已识别 ID</p>
          <p className="mt-4 text-3xl font-semibold tracking-[-0.05em] text-app-text-strong">
            {parsedTargets.filter((item) => item.parsedTargetId).length}
          </p>
        </SurfaceCard>
        <SurfaceCard className="rounded-[20px] p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-app-text-soft">待导入</p>
          <p className="mt-4 text-3xl font-semibold tracking-[-0.05em] text-app-text-strong">{parsedTargets.length}</p>
        </SurfaceCard>
      </section>

      <SurfaceCard>
        <SectionHeader
          title="单条解析"
          description="输入互动目标链接，点击解析提取目标 ID。"
          action={
            <button
              type="button"
              onClick={() => void parseSingle()}
              disabled={loading}
              className="app-button app-button-primary"
            >
              {loading ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
              {loading ? "解析中" : "解析"}
            </button>
          }
        />

        <div className="mt-4">
          <input
            value={targetUrl}
            onChange={(event) => setTargetUrl(event.target.value)}
            className="app-input w-full py-2.5"
            placeholder="https://weibo.cn/comment/HABCDEFGH 或其他互动目标链接"
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void parseSingle();
              }
            }}
          />
        </div>

        {error ? <AppNotice tone="error" className="mt-4">{error}</AppNotice> : null}
        {notice ? <AppNotice tone="success" className="mt-4">{notice}</AppNotice> : null}
      </SurfaceCard>

      <SurfaceCard>
        <SectionHeader
          title="批量解析"
          description="每行一条链接，系统逐条解析目标。"
          action={
            <button
              type="button"
              onClick={() => void parseBatch()}
              disabled={batchLoading}
              className="app-button app-button-primary"
            >
              {batchLoading ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
              {batchLoading ? "解析中" : "批量解析"}
            </button>
          }
        />

        <div className="mt-4">
          <textarea
            value={batchText}
            onChange={(event) => setBatchText(event.target.value)}
            className="app-input min-h-[120px] w-full resize-y py-3"
            placeholder="粘贴互动目标链接，每行一条"
          />
        </div>
      </SurfaceCard>

      <SurfaceCard>
        <SectionHeader
          title="解析结果"
          description={
            parsedTargets.length === 0
              ? "暂无解析结果，使用上方功能解析互动目标。"
              : `共 ${parsedTargets.length} 条解析结果`
          }
          action={
            parsedTargets.length > 0 ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setParsedTargets([])}
                  className="app-button app-button-secondary"
                >
                  清空
                </button>
                <button
                  type="button"
                  onClick={() => void importToCommentPool()}
                  disabled={importing}
                  className="app-button app-button-primary"
                >
                  {importing ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                  {importing ? "导入中" : "导入评论池"}
                </button>
              </div>
            ) : null
          }
        />

        {parsedTargets.length === 0 ? (
          <EmptyState title="暂无解析结果" description="使用上方功能解析互动目标链接。" />
        ) : (
          <TableShell className="mt-5">
            <table className="app-table min-w-[800px]">
              <thead>
                <tr>
                  <th>目标链接</th>
                  <th>目标类型</th>
                  <th>解析 ID</th>
                  <th>状态</th>
                  <th>创建时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {parsedTargets.map((target) => (
                  <tr key={target.id}>
                    <td className="max-w-[300px]">
                      <a
                        href={target.targetUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-app-accent underline underline-offset-2 hover:text-app-accent/70"
                      >
                        {target.targetUrl}
                      </a>
                    </td>
                    <td>
                      <StatusBadge tone="accent">{target.targetType}</StatusBadge>
                    </td>
                    <td className="font-mono text-xs text-app-text-soft">{target.parsedTargetId || "-"}</td>
                    <td>
                      {target.status === "PARSED" ? (
                        <StatusBadge tone="success">
                          <CheckCircle className="mr-1 h-3 w-3" />
                          已解析
                        </StatusBadge>
                      ) : (
                        <StatusBadge tone="neutral">{target.status}</StatusBadge>
                      )}
                    </td>
                    <td className="text-xs text-app-text-soft">
                      {target.createdAt ? new Date(target.createdAt).toLocaleString("zh-CN") : "-"}
                    </td>
                    <td>
                      <button
                        type="button"
                        onClick={() => removeParsedTarget(target.id)}
                        className="app-button app-button-secondary h-8 px-3 text-[11px] text-app-danger hover:border-app-danger/30 hover:text-app-danger"
                      >
                        <Trash2 className="mr-1 h-3 w-3" />
                        移除
                      </button>
                    </td>
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
