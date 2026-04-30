"use client";

import { useMemo, useState } from "react";

import { AppNotice } from "@/components/app-notice";
import type { ActionJob, CommentPoolItem, WeiboAccount } from "@/lib/app-data";
import { formatDateTime } from "@/lib/date";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { SectionHeader } from "@/components/section-header";
import { StatusBadge } from "@/components/status-badge";
import { SurfaceCard } from "@/components/surface-card";
import { TableShell } from "@/components/table-shell";

function getJobTypeText(jobType: ActionJob["jobType"]) {
  return jobType === "COMMENT_LIKE_BATCH" ? "控评点赞" : "轮转转发";
}

function getJobStatusText(status: ActionJob["status"]) {
  const map: Record<ActionJob["status"], string> = {
    PENDING: "待执行",
    RUNNING: "执行中",
    SUCCESS: "成功",
    PARTIAL_FAILED: "部分失败",
    FAILED: "失败",
    CANCELLED: "已取消",
  };

  return map[status] || status;
}

type HotCommentPreviewItem = {
  commentId: string;
  sourceUrl: string;
  text: string;
  author: string;
  likeCount?: number;
};

export function OpsManager({
  accounts,
  initialPoolItems,
  initialJobs,
}: {
  accounts: WeiboAccount[];
  initialPoolItems: CommentPoolItem[];
  initialJobs: ActionJob[];
}) {
  const [activeTab, setActiveTab] = useState<"POOL" | "ROTATION">("POOL");
  const [poolItems, setPoolItems] = useState(initialPoolItems);
  const [jobs, setJobs] = useState(initialJobs);
  const [selectedPoolIds, setSelectedPoolIds] = useState<string[]>([]);
  const [selectedPoolAccountIds, setSelectedPoolAccountIds] = useState<string[]>([]);
  const [selectedRotationAccountIds, setSelectedRotationAccountIds] = useState<string[]>([]);
  const [poolKeyword, setPoolKeyword] = useState("");
  const [singleUrl, setSingleUrl] = useState("");
  const [singleNote, setSingleNote] = useState("");
  const [singleTags, setSingleTags] = useState("");
  const [batchText, setBatchText] = useState("");
  const [batchNote, setBatchNote] = useState("");
  const [batchTags, setBatchTags] = useState("");
  const [hotCommentTargetUrl, setHotCommentTargetUrl] = useState("");
  const [hotCommentLimit, setHotCommentLimit] = useState(20);
  const [hotCommentKeywords, setHotCommentKeywords] = useState("");
  const [hotCommentPreview, setHotCommentPreview] = useState<HotCommentPreviewItem[]>([]);
  const [selectedHotCommentIds, setSelectedHotCommentIds] = useState<string[]>([]);
  const [rotationTargetUrl, setRotationTargetUrl] = useState("");
  const [rotationTimes, setRotationTimes] = useState(5);
  const [rotationIntervalSec, setRotationIntervalSec] = useState<0 | 3 | 5 | 10>(3);
  const [rotationCopyTexts, setRotationCopyTexts] = useState("1\n2\n3\n4\n5");
  const [jobStatusFilter, setJobStatusFilter] = useState<"ALL" | ActionJob["status"]>("ALL");
  const [submitting, setSubmitting] = useState(false);
  const [hotCommentLoading, setHotCommentLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const filteredPoolItems = useMemo(() => {
    const normalized = poolKeyword.trim().toLowerCase();
    if (!normalized) {
      return poolItems;
    }

    return poolItems.filter((item) => {
      return (
        item.sourceUrl.toLowerCase().includes(normalized) ||
        item.commentId.toLowerCase().includes(normalized) ||
        (item.note || "").toLowerCase().includes(normalized)
      );
    });
  }, [poolItems, poolKeyword]);

  const filteredJobs = useMemo(() => {
    if (jobStatusFilter === "ALL") {
      return jobs;
    }

    return jobs.filter((job) => job.status === jobStatusFilter);
  }, [jobStatusFilter, jobs]);

  async function refreshPool() {
    const response = await fetch("/api/comment-pool", { cache: "no-store" });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || "刷新控评池失败");
    }

    setPoolItems(result.data);
  }

  async function refreshJobs() {
    const response = await fetch("/api/action-jobs", { cache: "no-store" });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || "刷新任务失败");
    }

    setJobs(result.data);
  }

  async function createSinglePoolItem() {
    try {
      setSubmitting(true);
      setError(null);
      setNotice(null);

      const response = await fetch("/api/comment-pool", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceUrl: singleUrl,
          note: singleNote,
          tags: singleTags
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
        }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "新增控评链接失败");
      }

      setPoolItems((current) => [result.data, ...current]);
      setSingleUrl("");
      setSingleNote("");
      setSingleTags("");
      setNotice("控评链接已加入池子");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "新增控评链接失败");
    } finally {
      setSubmitting(false);
    }
  }

  async function batchImportPoolItems() {
    try {
      setSubmitting(true);
      setError(null);
      setNotice(null);

      const sourceUrls = batchText
        .split("\n")
        .map((item) => item.trim())
        .filter(Boolean);

      const response = await fetch("/api/comment-pool/batch-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceUrls,
          note: batchNote,
          tags: batchTags
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
        }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "批量导入失败");
      }

      await refreshPool();
      setBatchText("");
      setBatchNote("");
      setBatchTags("");
      setNotice(`导入 ${result.data.imported.length} 条，跳过 ${result.data.skipped.length} 条`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "批量导入失败");
    } finally {
      setSubmitting(false);
    }
  }

  async function fetchHotComments() {
    try {
      setHotCommentLoading(true);
      setError(null);
      setNotice(null);

      const response = await fetch("/api/comment-pool/hot-comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetUrl: hotCommentTargetUrl,
          limit: hotCommentLimit,
          keywords: hotCommentKeywords
            .split(/[,\n]/)
            .map((item) => item.trim())
            .filter(Boolean),
        }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "提取热门评论失败");
      }

      setHotCommentPreview(result.data);
      setSelectedHotCommentIds(result.data.map((item: HotCommentPreviewItem) => item.commentId));
      setNotice(`提取到 ${result.data.length} 条热门评论`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "提取热门评论失败");
    } finally {
      setHotCommentLoading(false);
    }
  }

  async function importSelectedHotComments() {
    try {
      setSubmitting(true);
      setError(null);
      setNotice(null);

      const selected = hotCommentPreview.filter((item) => selectedHotCommentIds.includes(item.commentId));
      const response = await fetch("/api/comment-pool/batch-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceUrls: selected.map((item) => item.sourceUrl),
          note: "热门评论导入",
          tags: ["热门评论"],
        }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "导入热门评论失败");
      }

      await refreshPool();
      setNotice(`已导入 ${result.data.imported.length} 条热门评论`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "导入热门评论失败");
    } finally {
      setSubmitting(false);
    }
  }

  async function createCommentLikeJob() {
    try {
      setSubmitting(true);
      setError(null);
      setNotice(null);

      const response = await fetch("/api/action-jobs/comment-like", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountIds: selectedPoolAccountIds,
          poolItemIds: selectedPoolIds,
          urgency: "S",
          targetNodeId: "AUTO",
        }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "创建控评任务失败");
      }

      setJobs((current) => [result.data, ...current]);
      setNotice(`控评任务已创建，目标节点 ${result.workerId || "AUTO"}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "创建控评任务失败");
    } finally {
      setSubmitting(false);
    }
  }

  async function createRotationJob() {
    try {
      setSubmitting(true);
      setError(null);
      setNotice(null);

      const copywritingTexts = rotationCopyTexts
        .split("\n")
        .map((item) => item.trim())
        .filter(Boolean);

      const response = await fetch("/api/action-jobs/repost-rotation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountIds: selectedRotationAccountIds,
          targetUrl: rotationTargetUrl,
          times: rotationTimes,
          intervalSec: rotationIntervalSec,
          copywritingTexts,
          urgency: "A",
          targetNodeId: "AUTO",
        }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "创建轮转任务失败");
      }

      setJobs((current) => [result.data, ...current]);
      setNotice(`轮转任务已创建，目标节点 ${result.workerId || "AUTO"}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "创建轮转任务失败");
    } finally {
      setSubmitting(false);
    }
  }

  async function stopJob(id: string) {
    try {
      setSubmitting(true);
      setError(null);
      setNotice(null);

      const response = await fetch(`/api/action-jobs/${id}/stop`, { method: "POST" });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "停止任务失败");
      }

      setJobs((current) => current.map((job) => (job.id === id ? result.data : job)));
      setNotice(result.message || "批量任务已停止");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "停止任务失败");
    } finally {
      setSubmitting(false);
    }
  }

  const stats = {
    pool: poolItems.length,
    running: jobs.filter((job) => job.status === "RUNNING").length,
    pending: jobs.filter((job) => job.status === "PENDING").length,
    failed: jobs.filter((job) => job.status === "FAILED" || job.status === "PARTIAL_FAILED").length,
  };

  return (
    <div className="space-y-6 lg:space-y-8">
      <PageHeader eyebrow="执行控制" title="先在独立前端接控评池、轮转创建和批次监控" description="这版优先把评论池管理、热门评论导入、控评创建、轮转创建和最近任务列表迁过来，让执行侧主链路先在新前端跑通。" />

      <section className="grid gap-4 md:grid-cols-4">
        <SurfaceCard className="rounded-[20px] p-5"><p className="text-xs uppercase tracking-[0.18em] text-app-text-soft">控评池</p><p className="mt-4 text-3xl font-semibold tracking-[-0.05em] text-app-text-strong">{stats.pool}</p></SurfaceCard>
        <SurfaceCard className="rounded-[20px] p-5"><p className="text-xs uppercase tracking-[0.18em] text-app-text-soft">待执行</p><p className="mt-4 text-3xl font-semibold tracking-[-0.05em] text-app-text-strong">{stats.pending}</p></SurfaceCard>
        <SurfaceCard className="rounded-[20px] p-5"><p className="text-xs uppercase tracking-[0.18em] text-app-text-soft">执行中</p><p className="mt-4 text-3xl font-semibold tracking-[-0.05em] text-app-text-strong">{stats.running}</p></SurfaceCard>
        <SurfaceCard className="rounded-[20px] p-5"><p className="text-xs uppercase tracking-[0.18em] text-app-text-soft">异常批次</p><p className="mt-4 text-3xl font-semibold tracking-[-0.05em] text-app-text-strong">{stats.failed}</p></SurfaceCard>
      </section>

      <SurfaceCard>
        <div className="flex gap-3">
          <button type="button" onClick={() => setActiveTab("POOL")} className={`app-button ${activeTab === "POOL" ? "app-button-primary" : "app-button-secondary"}`}>控评</button>
          <button type="button" onClick={() => setActiveTab("ROTATION")} className={`app-button ${activeTab === "ROTATION" ? "app-button-primary" : "app-button-secondary"}`}>轮转</button>
        </div>

        {error ? <AppNotice tone="error" className="mt-4">{error}</AppNotice> : null}
        {notice ? <AppNotice tone="success" className="mt-4">{notice}</AppNotice> : null}

        {activeTab === "POOL" ? (
          <div className="mt-5 space-y-6">
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="app-subpanel space-y-3">
                <h2 className="text-lg font-semibold tracking-[-0.03em] text-app-text-strong">单条加入控评池</h2>
                <input value={singleUrl} onChange={(event) => setSingleUrl(event.target.value)} className="app-input" placeholder="评论链接" />
                <input value={singleNote} onChange={(event) => setSingleNote(event.target.value)} className="app-input" placeholder="备注" />
                <input value={singleTags} onChange={(event) => setSingleTags(event.target.value)} className="app-input" placeholder="标签，多个用英文逗号分隔" />
                <button type="button" onClick={() => void createSinglePoolItem()} disabled={submitting} className="app-button app-button-primary">加入控评池</button>
              </div>

              <div className="app-subpanel space-y-3">
                <h2 className="text-lg font-semibold tracking-[-0.03em] text-app-text-strong">批量导入评论链接</h2>
                <textarea value={batchText} onChange={(event) => setBatchText(event.target.value)} className="app-input min-h-[140px] resize-y py-3" placeholder="每行一条评论链接" />
                <input value={batchNote} onChange={(event) => setBatchNote(event.target.value)} className="app-input" placeholder="备注" />
                <input value={batchTags} onChange={(event) => setBatchTags(event.target.value)} className="app-input" placeholder="标签，多个用英文逗号分隔" />
                <button type="button" onClick={() => void batchImportPoolItems()} disabled={submitting} className="app-button app-button-primary">批量导入</button>
              </div>
            </div>

            <div className="app-subpanel space-y-3">
              <h2 className="text-lg font-semibold tracking-[-0.03em] text-app-text-strong">提取热门评论</h2>
              <div className="grid gap-4 lg:grid-cols-4">
                <input value={hotCommentTargetUrl} onChange={(event) => setHotCommentTargetUrl(event.target.value)} className="app-input lg:col-span-2" placeholder="目标微博链接" />
                <input type="number" min={1} max={50} value={hotCommentLimit} onChange={(event) => setHotCommentLimit(Number(event.target.value) || 1)} className="app-input" placeholder="数量" />
                <input value={hotCommentKeywords} onChange={(event) => setHotCommentKeywords(event.target.value)} className="app-input" placeholder="关键词，逗号分隔" />
              </div>
              <div className="flex flex-wrap gap-3">
                <button type="button" onClick={() => void fetchHotComments()} disabled={hotCommentLoading} className="app-button app-button-secondary">
                  {hotCommentLoading ? "提取中..." : "提取热门评论"}
                </button>
                {hotCommentPreview.length > 0 ? (
                  <button type="button" onClick={() => void importSelectedHotComments()} disabled={submitting} className="app-button app-button-primary">
                    导入已选评论
                  </button>
                ) : null}
              </div>
            </div>

            <SurfaceCard className="rounded-[20px] p-5">
              <SectionHeader title="控评池与任务创建" action={<input value={poolKeyword} onChange={(event) => setPoolKeyword(event.target.value)} className="app-input md:w-[260px]" placeholder="搜索链接、评论ID或备注" />} />

              {filteredPoolItems.length === 0 ? (
                <div className="mt-5">
                  <EmptyState title="控评池为空" description="先导入评论链接，再选择账号创建控评点赞任务。" />
                </div>
              ) : (
                <div className="mt-5 space-y-5">
                  <TableShell>
                    <table className="app-table min-w-[1180px]">
                      <thead>
                        <tr>
                          <th>选择</th>
                          <th>评论ID</th>
                          <th>链接</th>
                          <th>标签</th>
                          <th>备注</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredPoolItems.map((item) => (
                          <tr key={item.id}>
                            <td>
                              <input
                                type="checkbox"
                                checked={selectedPoolIds.includes(item.id)}
                                onChange={() =>
                                  setSelectedPoolIds((current) =>
                                    current.includes(item.id) ? current.filter((id) => id !== item.id) : [...current, item.id],
                                  )
                                }
                              />
                            </td>
                            <td className="font-mono text-xs text-app-text-soft">{item.commentId}</td>
                            <td className="max-w-[320px] truncate text-app-text-muted">{item.sourceUrl}</td>
                            <td>
                              <div className="flex flex-wrap gap-2">
                                {item.tags.length > 0 ? item.tags.map((tag) => <span key={tag} className="app-chip">{tag}</span>) : <span className="text-app-text-soft">-</span>}
                              </div>
                            </td>
                            <td>{item.note || "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </TableShell>

                  <div className="app-subpanel">
                    <p className="text-sm text-app-text-muted">选择执行账号</p>
                    <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      {accounts.map((account) => (
                        <label key={account.id} className={`app-option-card ${selectedPoolAccountIds.includes(account.id) ? "app-option-card-active" : ""}`}>
                          <input
                            type="checkbox"
                            checked={selectedPoolAccountIds.includes(account.id)}
                            onChange={() =>
                              setSelectedPoolAccountIds((current) =>
                                current.includes(account.id) ? current.filter((id) => id !== account.id) : [...current, account.id],
                              )
                            }
                          />
                          <span>{account.nickname}</span>
                        </label>
                      ))}
                    </div>
                    <button type="button" onClick={() => void createCommentLikeJob()} disabled={submitting} className="app-button app-button-primary mt-5">
                      创建控评点赞任务
                    </button>
                  </div>
                </div>
              )}
            </SurfaceCard>
          </div>
        ) : (
          <div className="mt-5 space-y-5">
            <div className="app-subpanel">
              <h2 className="text-lg font-semibold tracking-[-0.03em] text-app-text-strong">创建轮转转发任务</h2>
              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <input value={rotationTargetUrl} onChange={(event) => setRotationTargetUrl(event.target.value)} className="app-input lg:col-span-2" placeholder="目标微博链接" />
                <input type="number" min={1} max={20} value={rotationTimes} onChange={(event) => setRotationTimes(Number(event.target.value) || 1)} className="app-input" placeholder="轮转次数" />
                <select value={rotationIntervalSec} onChange={(event) => setRotationIntervalSec(Number(event.target.value) as 0 | 3 | 5 | 10)} className="app-input">
                  <option value={0}>间隔 0 秒</option>
                  <option value={3}>间隔 3 秒</option>
                  <option value={5}>间隔 5 秒</option>
                  <option value={10}>间隔 10 秒</option>
                </select>
                <textarea value={rotationCopyTexts} onChange={(event) => setRotationCopyTexts(event.target.value)} className="app-input min-h-[140px] resize-y py-3 lg:col-span-2" placeholder="每行一条轮转文案" />
              </div>

              <div className="mt-5">
                <p className="text-sm text-app-text-muted">选择执行账号</p>
                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {accounts.map((account) => (
                    <label key={account.id} className={`app-option-card ${selectedRotationAccountIds.includes(account.id) ? "app-option-card-active" : ""}`}>
                      <input
                        type="checkbox"
                        checked={selectedRotationAccountIds.includes(account.id)}
                        onChange={() =>
                          setSelectedRotationAccountIds((current) =>
                            current.includes(account.id) ? current.filter((id) => id !== account.id) : [...current, account.id],
                          )
                        }
                      />
                      <span>{account.nickname}</span>
                    </label>
                  ))}
                </div>
              </div>

              <button type="button" onClick={() => void createRotationJob()} disabled={submitting} className="app-button app-button-primary mt-5">
                创建轮转任务
              </button>
            </div>
          </div>
        )}
      </SurfaceCard>

      <SurfaceCard>
        <SectionHeader
          title="最近批次"
          description="观察最近的控评与轮转创建结果、任务状态和账号运行摘要。"
          action={
            <div className="flex gap-3">
              <select value={jobStatusFilter} onChange={(event) => setJobStatusFilter(event.target.value as typeof jobStatusFilter)} className="app-input md:w-[180px]">
                <option value="ALL">全部状态</option>
                <option value="PENDING">待执行</option>
                <option value="RUNNING">执行中</option>
                <option value="SUCCESS">成功</option>
                <option value="PARTIAL_FAILED">部分失败</option>
                <option value="FAILED">失败</option>
                <option value="CANCELLED">已取消</option>
              </select>
              <button type="button" onClick={() => void refreshJobs()} className="app-button app-button-secondary">
                刷新任务
              </button>
            </div>
          }
        />

        {filteredJobs.length === 0 ? (
          <div className="mt-5">
            <EmptyState title="暂无批次任务" description="当前还没有创建控评或轮转批次。创建后，这里会展示任务状态、账号运行结果和人工停止入口。" />
          </div>
        ) : (
          <TableShell className="mt-5">
            <table className="app-table min-w-[1180px]">
              <thead>
                <tr>
                  <th>类型</th>
                  <th>创建时间</th>
                  <th>账号数</th>
                  <th>状态</th>
                  <th>摘要</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredJobs.map((job) => (
                  <tr key={job.id}>
                    <td className="font-medium text-app-text-strong">{getJobTypeText(job.jobType)}</td>
                    <td className="text-xs text-app-text-soft">{formatDateTime(job.createdAt)}</td>
                    <td>{job.accountRuns.length}</td>
                    <td>
                      <StatusBadge tone={job.status === "SUCCESS" ? "success" : job.status === "FAILED" || job.status === "PARTIAL_FAILED" ? "danger" : job.status === "RUNNING" ? "info" : job.status === "CANCELLED" ? "warning" : "neutral"}>
                        {getJobStatusText(job.status)}
                      </StatusBadge>
                    </td>
                    <td className="max-w-[320px] text-xs leading-6 text-app-text-soft">
                      {job.accountRuns
                        .slice(0, 3)
                        .map((run) => `${run.account.nickname}:${run.status}`)
                        .join(" / ") || "-"}
                    </td>
                    <td>
                      <button type="button" onClick={() => void stopJob(job.id)} disabled={submitting || job.status === "CANCELLED" || job.status === "SUCCESS"} className="app-button app-button-secondary h-10 px-4 text-xs">
                        停止批次
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
