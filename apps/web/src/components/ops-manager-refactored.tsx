"use client";

import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { AppNotice } from "@/components/app-notice";
import { ActionJobsManager } from "@/components/action-jobs-manager";
import { HotCommentsExtractor } from "@/components/hot-comments-extractor";
import { InteractionTargetParser } from "@/components/interaction-target-parser";
import { RepostRotationForm } from "@/components/repost-rotation-form";
import { CommentPoolList } from "./ops/comment-pool-list";
import { CommentPoolForm } from "./ops/comment-pool-form";
import { JobsList } from "./ops/jobs-list";
import type { OpsManagerProps, OpsTab, PoolFormData } from "./ops/types";
import type { ActionJob, CommentPoolItem } from "@/lib/app-data";

export function OpsManagerRefactored({
  accounts,
  initialPoolItems,
  initialJobs,
}: OpsManagerProps) {
  // 状态管理
  const [activeTab, setActiveTab] = useState<OpsTab>("POOL");
  const [poolItems, setPoolItems] = useState(initialPoolItems);
  const [jobs, setJobs] = useState(initialJobs);
  const [selectedPoolIds, setSelectedPoolIds] = useState<string[]>([]);
  const [selectedJobIds, setSelectedJobIds] = useState<string[]>([]);
  const [poolKeyword, setPoolKeyword] = useState("");
  const [jobStatusFilter, setJobStatusFilter] = useState<"ALL" | ActionJob["status"]>("ALL");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // 评论池操作
  const handleAddToPool = async (data: PoolFormData) => {
    try {
      setError(null);

      // 单条添加
      if (data.singleUrl.trim()) {
        const response = await fetch("/api/comment-pool", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sourceUrl: data.singleUrl.trim(),
            note: data.singleNote.trim() || undefined,
            tags: data.singleTags
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean),
          }),
        });

        const result = await response.json();
        if (!result.success) {
          throw new Error(result.message || "添加失败");
        }

        setPoolItems([result.data, ...poolItems]);
        setNotice("评论已添加到池中");
        return;
      }

      // 批量添加
      if (data.batchText.trim()) {
        const urls = data.batchText
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean);

        const response = await fetch("/api/comment-pool/batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            urls,
            note: data.batchNote.trim() || undefined,
            tags: data.batchTags
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean),
          }),
        });

        const result = await response.json();
        if (!result.success) {
          throw new Error(result.message || "批量添加失败");
        }

        setPoolItems([...result.data, ...poolItems]);
        setNotice(`成功添加 ${result.data.length} 条评论到池中`);
        return;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "操作失败");
    }
  };

  const handleDeletePoolItems = async (ids: string[]) => {
    try {
      setError(null);

      const response = await fetch("/api/comment-pool/batch-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.message || "删除失败");
      }

      setPoolItems(poolItems.filter((item) => !ids.includes(item.id)));
      setNotice(`成功删除 ${ids.length} 条评论`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除失败");
    }
  };

  // 任务操作
  const handleRefreshJobs = async () => {
    try {
      setError(null);

      const response = await fetch("/api/action-jobs");
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || "刷新失败");
      }

      setJobs(result.data);
      setNotice("任务列表已刷新");
    } catch (err) {
      setError(err instanceof Error ? err.message : "刷新失败");
    }
  };

  const handleDeleteJobs = async (ids: string[]) => {
    try {
      setError(null);

      const response = await fetch("/api/action-jobs/batch-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.message || "删除失败");
      }

      setJobs(jobs.filter((job) => !ids.includes(job.id)));
      setNotice(`成功删除 ${ids.length} 个任务`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除失败");
    }
  };

  return (
    <div className="space-y-6 lg:space-y-8">
      <PageHeader
        title="运营工具"
        description="评论池管理、热评提取、互动任务和轮转转发。"
      />

      {error && <AppNotice tone="error">{error}</AppNotice>}
      {notice && <AppNotice tone="success">{notice}</AppNotice>}

      {/* 标签页 */}
      <div className="flex gap-2 border-b border-app-line">
        <button
          type="button"
          onClick={() => setActiveTab("POOL")}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === "POOL"
              ? "border-b-2 border-app-accent text-app-accent"
              : "text-app-text-soft hover:text-app-text"
          }`}
        >
          评论池
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("HOT")}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === "HOT"
              ? "border-b-2 border-app-accent text-app-accent"
              : "text-app-text-soft hover:text-app-text"
          }`}
        >
          热评提取
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("TARGET")}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === "TARGET"
              ? "border-b-2 border-app-accent text-app-accent"
              : "text-app-text-soft hover:text-app-text"
          }`}
        >
          互动任务
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("ROTATION")}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === "ROTATION"
              ? "border-b-2 border-app-accent text-app-accent"
              : "text-app-text-soft hover:text-app-text"
          }`}
        >
          轮转转发
        </button>
      </div>

      {/* 内容区域 */}
      {activeTab === "POOL" && (
        <div className="space-y-6">
          <CommentPoolForm onSubmit={handleAddToPool} />
          <CommentPoolList
            items={poolItems}
            keyword={poolKeyword}
            onKeywordChange={setPoolKeyword}
            selectedIds={selectedPoolIds}
            onSelectionChange={setSelectedPoolIds}
            onDelete={handleDeletePoolItems}
          />
          <JobsList
            jobs={jobs}
            statusFilter={jobStatusFilter}
            onStatusFilterChange={setJobStatusFilter}
            selectedIds={selectedJobIds}
            onSelectionChange={setSelectedJobIds}
            onRefresh={handleRefreshJobs}
            onDelete={handleDeleteJobs}
          />
        </div>
      )}

      {activeTab === "HOT" && <HotCommentsExtractor />}
      {activeTab === "TARGET" && <InteractionTargetParser />}
      {activeTab === "ROTATION" && <RepostRotationForm initialAccounts={accounts} />}
    </div>
  );
}
