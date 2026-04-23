"use client";

import type { ActionJob, ActionJobAccountRun, CommentLinkPoolItem, WeiboAccount } from "@/generated/prisma/client";
import { canManageBusinessData } from "@/lib/permission-rules";
import type { AppRole } from "@/lib/permission-rules";
import type { ExecutionStrategy } from "@/server/strategy/config";
import { FormEvent, useMemo, useState } from "react";

type ActionJobWithRuns = ActionJob & {
  accountRuns: Array<
    ActionJobAccountRun & {
      account: {
        id: string;
        nickname: string;
      };
    }
  >;
};

type RepostTargetPreview = {
  valid: boolean;
  accountUid?: string;
  statusId?: string;
  message: string;
};

type JobForecast = {
  targetMinutes: number;
  limitMinutes: number;
  riskLevel: "low" | "medium" | "high";
  notes: string[];
};

function estimateJobForecast(input: {
  urgency: "S" | "A" | "B";
  accountIds: string[];
  multiplier?: number;
  accounts: WeiboAccount[];
  strategy: ExecutionStrategy;
}): JobForecast {
  const urgencyConfig = input.strategy.actionJob.urgency[input.urgency];
  const selectedAccounts = input.accounts.filter((account) => input.accountIds.includes(account.id));
  const proxyBuckets = new Set(selectedAccounts.map((account) => account.proxyNodeId || `account:${account.id}`));
  const multiplier = Math.max(1, input.multiplier || 1);
  const actionCount = Math.max(1, input.accountIds.length * multiplier);
  const targetMinutes = Math.max(1, Math.ceil((urgencyConfig.targetSlaSec * multiplier) / 60));
  const limitMinutes = Math.max(targetMinutes, Math.ceil((urgencyConfig.limitSlaSec * multiplier) / 60));
  const notes: string[] = [];
  let riskScore = input.urgency === "S" ? 2 : input.urgency === "A" ? 1 : 0;

  if (input.accountIds.length >= 8) {
    riskScore += 1;
    notes.push(`当前选择 ${input.accountIds.length} 个账号，同一时段集中执行风险会升高。`);
  }

  if (actionCount >= 20) {
    riskScore += 1;
    notes.push(`本次预计触发 ${actionCount} 次动作，建议只在确有时效需求时使用高时效档。`);
  }

  if (proxyBuckets.size <= 1 && input.accountIds.length >= 4) {
    riskScore += 1;
    notes.push("当前账号基本共享同一出口环境，系统会自动放慢一部分节奏。");
  }

  if (input.urgency === "B") {
    notes.push("B 级更适合全天分散完成，优先降低账号风险。");
  }

  if (input.urgency === "S") {
    notes.push("S 级会优先抢占调度资源，适合控评等强时效任务。");
  }

  return {
    targetMinutes,
    limitMinutes,
    riskLevel: riskScore >= 3 ? "high" : riskScore >= 1 ? "medium" : "low",
    notes,
  };
}

function parseRepostTargetPreview(targetUrl: string): RepostTargetPreview {
  const raw = targetUrl.trim();

  if (!raw) {
    return {
      valid: false,
      message: "请先输入目标微博详情链接",
    };
  }

  let parsedUrl: URL;

  try {
    parsedUrl = new URL(raw);
  } catch {
    return {
      valid: false,
      message: "链接格式无效，请粘贴完整 URL",
    };
  }

  const hostname = parsedUrl.hostname.toLowerCase();

  if (!hostname.includes("weibo.com")) {
    return {
      valid: false,
      message: "请使用 weibo.com 详情链接，不支持短链或其他域名",
    };
  }

  const segments = parsedUrl.pathname.split("/").filter(Boolean);

  if (segments.length >= 2) {
    const accountUid = segments[0];
    const statusId = segments[1];

    if (/^\d+$/.test(accountUid) && /^[0-9a-zA-Z]{6,20}$/.test(statusId)) {
      return {
        valid: true,
        accountUid,
        statusId,
        message: `将转发 UID ${accountUid} 下微博 ${statusId}`,
      };
    }
  }

  if (segments[0] === "detail" && /^[0-9a-zA-Z]{6,20}$/.test(segments[1] || "")) {
    return {
      valid: true,
      statusId: segments[1],
      message: `将转发微博 ${segments[1]}（detail 链接）`,
    };
  }

  return {
    valid: false,
    message: "请使用 weibo.com/{uid}/{bid|mid} 或 weibo.com/detail/{id} 链接",
  };
}

const jobStatusText: Record<ActionJob["status"], string> = {
  PENDING: "待执行",
  RUNNING: "执行中",
  SUCCESS: "成功",
  PARTIAL_FAILED: "部分失败",
  FAILED: "失败",
  CANCELLED: "已取消",
};

export function OpsManager({
  accounts,
  currentUserRole,
  initialJobs,
  initialPoolItems,
  initialStrategy,
}: {
  accounts: WeiboAccount[];
  currentUserRole: AppRole;
  initialJobs: ActionJobWithRuns[];
  initialPoolItems: CommentLinkPoolItem[];
  initialStrategy: ExecutionStrategy;
}) {
  const canManage = canManageBusinessData(currentUserRole);
  const [mobileView, setMobileView] = useState<"CREATE" | "TASKS">("CREATE");
  const [activeTab, setActiveTab] = useState<"POOL" | "ROTATION">("POOL");
  const [poolItems, setPoolItems] = useState(initialPoolItems);
  const [jobs, setJobs] = useState(initialJobs);
  const [selectedPoolIds, setSelectedPoolIds] = useState<string[]>([]);
  const [selectedPoolAccountIds, setSelectedPoolAccountIds] = useState<string[]>([]);
  const [selectedRotationAccountIds, setSelectedRotationAccountIds] = useState<string[]>([]);
  const [poolKeyword, setPoolKeyword] = useState("");
  const [poolTagFilter, setPoolTagFilter] = useState("ALL");
  const [singleUrl, setSingleUrl] = useState("");
  const [singleNote, setSingleNote] = useState("");
  const [singleTags, setSingleTags] = useState("");
  const [batchText, setBatchText] = useState("");
  const [batchNote, setBatchNote] = useState("");
  const [batchTags, setBatchTags] = useState("");
  const [forceDuplicate, setForceDuplicate] = useState(false);
  const [rotationTargetUrl, setRotationTargetUrl] = useState("");
  const [rotationTimes, setRotationTimes] = useState(5);
  const [rotationIntervalSec, setRotationIntervalSec] = useState<0 | 3 | 5 | 10>(3);
  const [commentLikeUrgency, setCommentLikeUrgency] = useState<"S" | "A" | "B">("S");
  const [rotationUrgency, setRotationUrgency] = useState<"S" | "A" | "B">("A");
  const [rotationCopyTexts, setRotationCopyTexts] = useState("1\n2\n3\n4\n5");
  const [jobStatusFilter, setJobStatusFilter] = useState<"ALL" | ActionJob["status"]>("ALL");
  const [submitting, setSubmitting] = useState(false);
  const [batchDeleting, setBatchDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);

  const repostTargetPreview = useMemo(() => parseRepostTargetPreview(rotationTargetUrl), [rotationTargetUrl]);

  const commentLikeForecast = useMemo(
    () => estimateJobForecast({ urgency: commentLikeUrgency, accountIds: selectedPoolAccountIds, accounts, strategy: initialStrategy }),
    [commentLikeUrgency, selectedPoolAccountIds, accounts, initialStrategy],
  );

  const rotationForecast = useMemo(
    () =>
      estimateJobForecast({
        urgency: rotationUrgency,
        accountIds: selectedRotationAccountIds,
        multiplier: rotationTimes,
        accounts,
        strategy: initialStrategy,
      }),
    [rotationUrgency, selectedRotationAccountIds, rotationTimes, accounts, initialStrategy],
  );

  function riskToneClass(riskLevel: JobForecast["riskLevel"]) {
    if (riskLevel === "high") {
      return "bg-rose-50 text-rose-700 border border-rose-200";
    }

    if (riskLevel === "medium") {
      return "bg-amber-50 text-amber-700 border border-amber-200";
    }

    return "bg-emerald-50 text-emerald-700 border border-emerald-200";
  }

  const filteredJobs = useMemo(() => {
    if (jobStatusFilter === "ALL") {
      return jobs;
    }

    return jobs.filter((job) => job.status === jobStatusFilter);
  }, [jobStatusFilter, jobs]);

  function getJobTypeText(jobType: ActionJob["jobType"]) {
    return jobType === "COMMENT_LIKE_BATCH" ? "控评点赞" : "轮转转发";
  }

  function getJobUrgency(job: ActionJobWithRuns): "S" | "A" | "B" {
    const config = (job.config || {}) as { urgency?: "S" | "A" | "B" };
    return config.urgency || (job.jobType === "COMMENT_LIKE_BATCH" ? "S" : "A");
  }

  function getUrgencyText(urgency: "S" | "A" | "B") {
    if (urgency === "S") {
      return "S级时效";
    }

    if (urgency === "A") {
      return "A级时效";
    }

    return "B级慢增";
  }

  function getJobSlaText(job: ActionJobWithRuns) {
    const summary = (job.summary || {}) as {
      sla?: {
        targetMinutes?: number;
        limitMinutes?: number;
        withinTargetAccounts?: number;
        withinLimitAccounts?: number;
        measuredAccounts?: number;
      };
    };
    const sla = summary.sla;

    if (!sla || !sla.measuredAccounts) {
      return "SLA统计待生成";
    }

    return `目标${sla.targetMinutes || 0}分钟内 ${sla.withinTargetAccounts || 0}/${sla.measuredAccounts}，上限${sla.limitMinutes || 0}分钟内 ${sla.withinLimitAccounts || 0}/${sla.measuredAccounts}`;
  }

  function toggleJobExpanded(id: string) {
    setExpandedJobId((current) => (current === id ? null : id));
  }

  const availableTags = useMemo(() => {
    const tags = new Set<string>();

    for (const item of poolItems) {
      for (const tag of item.tags) {
        if (tag.trim()) {
          tags.add(tag.trim());
        }
      }
    }

    return Array.from(tags).sort();
  }, [poolItems]);

  const filteredPoolItems = useMemo(() => {
    return poolItems.filter((item) => {
      const keyword = poolKeyword.trim().toLowerCase();
      const matchesKeyword =
        keyword === "" ||
        item.sourceUrl.toLowerCase().includes(keyword) ||
        (item.commentId || "").toLowerCase().includes(keyword) ||
        (item.note || "").toLowerCase().includes(keyword);
      const matchesTag = poolTagFilter === "ALL" || item.tags.includes(poolTagFilter);

      return matchesKeyword && matchesTag;
    });
  }, [poolItems, poolKeyword, poolTagFilter]);

  function parseTags(input: string) {
    return input
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function togglePoolItem(id: string) {
    setSelectedPoolIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function selectAllFilteredPoolItems() {
    setSelectedPoolIds(filteredPoolItems.map((item) => item.id));
  }

  function clearSelectedPoolItems() {
    setSelectedPoolIds([]);
  }

  function togglePoolAccount(id: string) {
    setSelectedPoolAccountIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function selectAllPoolAccounts() {
    setSelectedPoolAccountIds(accounts.map((account) => account.id));
  }

  function clearPoolAccounts() {
    setSelectedPoolAccountIds([]);
  }

  function toggleRotationAccount(id: string) {
    setSelectedRotationAccountIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function selectAllRotationAccounts() {
    setSelectedRotationAccountIds(accounts.map((account) => account.id));
  }

  function clearRotationAccounts() {
    setSelectedRotationAccountIds([]);
  }

  async function refreshPool() {
    const response = await fetch("/api/comment-pool", { cache: "no-store" });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || "刷新控评池失败");
    }

    setPoolItems(result.data);
  }

  async function handleCreateSingle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setSubmitting(true);
      setError(null);

      const response = await fetch("/api/comment-pool", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceUrl: singleUrl,
          note: singleNote,
          tags: parseTags(singleTags),
          forceDuplicate,
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "新增控评链接失败");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleBatchImport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const sourceUrls = batchText
      .split(/\n+/)
      .map((item) => item.trim())
      .filter(Boolean);

    if (sourceUrls.length === 0) {
      setError("请先粘贴至少一条链接");
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const response = await fetch("/api/comment-pool/batch-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceUrls,
          note: batchNote,
          tags: parseTags(batchTags),
          forceDuplicate,
        }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "批量导入失败");
      }

      await refreshPool();
      setBatchText("");

      const importedCount = result.data?.imported?.length || 0;
      const skippedCount = result.data?.skipped?.length || 0;

      if (skippedCount > 0) {
        setError(`导入完成：成功 ${importedCount} 条，跳过 ${skippedCount} 条`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "批量导入失败");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeletePoolItem(id: string) {
    if (!window.confirm("确认删除这条控评链接吗？")) {
      return;
    }

    try {
      setError(null);

      const response = await fetch(`/api/comment-pool/${id}`, { method: "DELETE" });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "删除控评链接失败");
      }

      setPoolItems((current) => current.filter((item) => item.id !== id));
      setSelectedPoolIds((current) => current.filter((item) => item !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除控评链接失败");
    }
  }

  async function handleBatchDeletePoolItems() {
    const selectedSet = new Set(selectedPoolIds);
    const candidates =
      selectedPoolIds.length > 0 ? filteredPoolItems.filter((item) => selectedSet.has(item.id)) : filteredPoolItems;

    if (candidates.length === 0) {
      setError("当前筛选下没有可删除的控评链接");
      return;
    }

    if (!window.confirm(`确认删除 ${candidates.length} 条控评链接吗？该操作不可恢复。`)) {
      return;
    }

    try {
      setBatchDeleting(true);
      setError(null);

      let failed = 0;

      for (const item of candidates) {
        try {
          const response = await fetch(`/api/comment-pool/${item.id}`, { method: "DELETE" });
          const result = await response.json();

          if (!response.ok) {
            throw new Error(result.message || "删除控评链接失败");
          }

          setPoolItems((current) => current.filter((poolItem) => poolItem.id !== item.id));
          setSelectedPoolIds((current) => current.filter((id) => id !== item.id));
        } catch {
          failed += 1;
        }
      }

      if (failed > 0) {
        setError(`批量删除完成，失败 ${failed} 条控评链接`);
      }
    } finally {
      setBatchDeleting(false);
    }
  }

  async function handleStartCommentLikeJob() {
    if (selectedPoolIds.length === 0) {
      setError("请先选择评论链接");
      return;
    }

    if (selectedPoolAccountIds.length === 0) {
      setError("请先选择账号");
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const response = await fetch("/api/action-jobs/comment-like", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountIds: selectedPoolAccountIds,
          poolItemIds: selectedPoolIds,
          urgency: commentLikeUrgency,
        }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "启动控评点赞失败");
      }

      setJobs((current) => [result.data, ...current]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "启动控评点赞失败");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStartRotationJob(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (selectedRotationAccountIds.length === 0) {
      setError("请先选择至少一个账号");
      return;
    }

    if (!repostTargetPreview.valid) {
      setError(repostTargetPreview.message);
      return;
    }

    const copywritingTexts = rotationCopyTexts
      .split(/\n+/)
      .map((item) => item.trim())
      .filter(Boolean);

    try {
      setSubmitting(true);
      setError(null);

      const response = await fetch("/api/action-jobs/repost-rotation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountIds: selectedRotationAccountIds,
          targetUrl: rotationTargetUrl,
          times: rotationTimes,
          intervalSec: rotationIntervalSec,
          copywritingTexts,
          urgency: rotationUrgency,
        }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "启动轮转转发失败");
      }

      setJobs((current) => [result.data, ...current]);
      setRotationTargetUrl("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "启动轮转转发失败");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStopJob(id: string) {
    if (!window.confirm("确认停止这批任务吗？")) {
      return;
    }

    try {
      setError(null);

      const response = await fetch(`/api/action-jobs/${id}/stop`, {
        method: "POST",
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "停止批量任务失败");
      }

      setJobs((current) => current.map((job) => (job.id === id ? result.data : job)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "停止批量任务失败");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">控评与轮转</h2>
        <p className="mt-1 text-sm text-slate-500">维护控评评论池并批量点赞，或按账号立即执行 5 次轮转转发。</p>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-2 shadow-sm md:hidden">
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setMobileView("CREATE")}
            className={`rounded-xl px-4 py-3 text-sm font-medium ${mobileView === "CREATE" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"}`}
          >
            创建任务
          </button>
          <button
            type="button"
            onClick={() => setMobileView("TASKS")}
            className={`rounded-xl px-4 py-3 text-sm font-medium ${mobileView === "TASKS" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"}`}
          >
            最近任务
          </button>
        </div>
      </section>

      <section className={`${mobileView === "TASKS" ? "hidden md:block " : ""}rounded-xl border border-slate-200 bg-white p-4 shadow-sm`}>
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab("POOL")}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${activeTab === "POOL" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"}`}
          >
            控评池
          </button>
          <button
            onClick={() => setActiveTab("ROTATION")}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${activeTab === "ROTATION" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"}`}
          >
            轮转转发
          </button>
        </div>
      </section>

      {activeTab === "POOL" ? (
        <>
          {canManage ? (
            <section className={`${mobileView === "TASKS" ? "hidden md:grid " : ""}grid gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-2 md:p-6`}>
              <form onSubmit={handleCreateSingle} className="space-y-3">
                <h3 className="text-base font-medium">新增单条链接</h3>
                <input
                  value={singleUrl}
                  onChange={(event) => setSingleUrl(event.target.value)}
                  placeholder="评论直达或举报链接"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-slate-400"
                />
                <input
                  value={singleNote}
                  onChange={(event) => setSingleNote(event.target.value)}
                  placeholder="备注（可选）"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-slate-400"
                />
                <input
                  value={singleTags}
                  onChange={(event) => setSingleTags(event.target.value)}
                  placeholder="标签，逗号分隔（可选）"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-slate-400"
                />
                <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" checked={forceDuplicate} onChange={(event) => setForceDuplicate(event.target.checked)} />
                  强制重复导入
                </label>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  新增
                </button>
              </form>

              <form onSubmit={handleBatchImport} className="space-y-3">
                <h3 className="text-base font-medium">批量导入链接</h3>
                <textarea
                  value={batchText}
                  onChange={(event) => setBatchText(event.target.value)}
                  placeholder="每行一条链接"
                  className="h-32 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-slate-400"
                />
                <input
                  value={batchNote}
                  onChange={(event) => setBatchNote(event.target.value)}
                  placeholder="统一备注（可选）"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-slate-400"
                />
                <input
                  value={batchTags}
                  onChange={(event) => setBatchTags(event.target.value)}
                  placeholder="统一标签，逗号分隔（可选）"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-slate-400"
                />
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  批量导入
                </button>
              </form>
            </section>
          ) : null}

          <section className={`${mobileView === "TASKS" ? "hidden md:block " : ""}rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:p-6`}>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <h3 className="text-lg font-medium">控评池列表</h3>
              <div className="flex flex-col gap-2 md:flex-row">
                <input
                  value={poolKeyword}
                  onChange={(event) => setPoolKeyword(event.target.value)}
                  placeholder="搜索链接/评论ID/备注"
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-slate-400"
                />
                <select
                  value={poolTagFilter}
                  onChange={(event) => setPoolTagFilter(event.target.value)}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-slate-400"
                >
                  <option value="ALL">全部标签</option>
                  {availableTags.map((tag) => (
                    <option key={tag} value={tag}>
                      {tag}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={selectAllFilteredPoolItems}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                >
                  全选当前筛选
                </button>
                <button
                  type="button"
                  onClick={clearSelectedPoolItems}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                >
                  清空已选
                </button>
                {canManage ? (
                  <button
                    type="button"
                    onClick={handleBatchDeletePoolItems}
                    disabled={batchDeleting}
                    className="rounded-lg border border-rose-200 px-3 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {batchDeleting
                      ? "删除中..."
                      : selectedPoolIds.length > 0
                        ? `删除选中 (${selectedPoolIds.length})`
                        : "删除当前筛选"}
                  </button>
                ) : null}
              </div>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-3 py-2 font-medium">选择</th>
                    <th className="px-3 py-2 font-medium">链接</th>
                    <th className="px-3 py-2 font-medium">评论 ID</th>
                    <th className="px-3 py-2 font-medium">备注</th>
                    <th className="px-3 py-2 font-medium">标签</th>
                    <th className="px-3 py-2 font-medium">时间</th>
                    {canManage ? <th className="px-3 py-2 font-medium">操作</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {filteredPoolItems.length === 0 ? (
                    <tr>
                      <td colSpan={canManage ? 7 : 6} className="px-3 py-6 text-slate-500">
                        暂无控评链接。
                      </td>
                    </tr>
                  ) : (
                    filteredPoolItems.map((item) => (
                      <tr key={item.id} className="border-t border-slate-200 align-top">
                        <td className="px-3 py-3">
                          <input checked={selectedPoolIds.includes(item.id)} onChange={() => togglePoolItem(item.id)} type="checkbox" />
                        </td>
                        <td className="max-w-sm px-3 py-3 text-sky-700">{item.sourceUrl}</td>
                        <td className="px-3 py-3">{item.commentId || "-"}</td>
                        <td className="px-3 py-3">{item.note || "-"}</td>
                        <td className="px-3 py-3">{item.tags.length > 0 ? item.tags.join(", ") : "-"}</td>
                        <td className="px-3 py-3">{new Date(item.createdAt).toLocaleString("zh-CN")}</td>
                        {canManage ? (
                          <td className="px-3 py-3">
                            <button onClick={() => handleDeletePoolItem(item.id)} className="text-rose-700 hover:text-rose-800">
                              删除
                            </button>
                          </td>
                        ) : null}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {canManage ? (
            <section className={`${mobileView === "TASKS" ? "hidden md:block " : ""}rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:p-6`}>
              <h3 className="text-lg font-medium">立即控评点赞</h3>
              <p className="mt-1 text-sm text-slate-500">已选评论 {selectedPoolIds.length} 条；请选择执行账号后立即开始。</p>
              <div className="mt-3 flex items-center gap-3 text-xs">
                <button type="button" onClick={selectAllPoolAccounts} className="text-sky-700 hover:text-sky-800">
                  全选账号
                </button>
                <button type="button" onClick={clearPoolAccounts} className="text-slate-600 hover:text-slate-700">
                  清空账号
                </button>
              </div>
              <div className="mt-4 grid gap-2 md:grid-cols-3">
                {accounts.map((account) => (
                  <label key={account.id} className="flex items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" checked={selectedPoolAccountIds.includes(account.id)} onChange={() => togglePoolAccount(account.id)} />
                    {account.nickname}
                  </label>
                ))}
              </div>
              <div className="mt-4">
                <select
                  value={commentLikeUrgency}
                  onChange={(event) => setCommentLikeUrgency(event.target.value as "S" | "A" | "B")}
                  className="mb-3 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-slate-400"
                >
                  <option value="S">S级时效（5-10分钟）</option>
                  <option value="A">A级时效（10-30分钟）</option>
                  <option value="B">B级慢增（30分钟以上）</option>
                </select>
                <div className="mb-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${riskToneClass(commentLikeForecast.riskLevel)}`}>
                      风险 {commentLikeForecast.riskLevel === "high" ? "偏高" : commentLikeForecast.riskLevel === "medium" ? "中等" : "较低"}
                    </span>
                    <span>预计 {commentLikeForecast.targetMinutes} 分钟内完成，最慢不超过 {commentLikeForecast.limitMinutes} 分钟。</span>
                  </div>
                  {commentLikeForecast.notes.length > 0 ? (
                    <div className="mt-2 space-y-1 text-xs text-slate-500">
                      {commentLikeForecast.notes.map((note) => (
                        <p key={note}>{note}</p>
                      ))}
                    </div>
                  ) : null}
                </div>
                <button
                  disabled={submitting}
                  onClick={handleStartCommentLikeJob}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  开始控评点赞
                </button>
              </div>
            </section>
          ) : null}
        </>
      ) : (
        <section className={`${mobileView === "TASKS" ? "hidden md:block " : ""}rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:p-6`}>
          <h3 className="text-lg font-medium">立即轮转转发</h3>
          <form className="mt-4 space-y-4" onSubmit={handleStartRotationJob}>
            <input
              value={rotationTargetUrl}
              onChange={(event) => setRotationTargetUrl(event.target.value)}
              placeholder="微博详情链接"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-slate-400"
            />
            <p className={`text-xs ${repostTargetPreview.valid ? "text-emerald-600" : "text-amber-600"}`}>
              {repostTargetPreview.message}
              {repostTargetPreview.valid && repostTargetPreview.accountUid
                ? "；请确认这就是 B 的转发详情链接，否则会转发到别的微博。"
                : ""}
            </p>
            <div className="flex items-center gap-3 text-xs">
              <button type="button" onClick={selectAllRotationAccounts} className="text-sky-700 hover:text-sky-800">
                全选账号
              </button>
              <button type="button" onClick={clearRotationAccounts} className="text-slate-600 hover:text-slate-700">
                清空账号
              </button>
            </div>
            <div className="grid gap-2 md:grid-cols-3">
              {accounts.map((account) => (
                <label key={account.id} className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={selectedRotationAccountIds.includes(account.id)}
                    onChange={() => toggleRotationAccount(account.id)}
                  />
                  {account.nickname}
                </label>
              ))}
            </div>
            <select
              value={rotationUrgency}
              onChange={(event) => setRotationUrgency(event.target.value as "S" | "A" | "B")}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-slate-400"
            >
              <option value="S">S级时效（5-10分钟）</option>
              <option value="A">A级时效（10-30分钟）</option>
              <option value="B">B级慢增（30分钟以上）</option>
            </select>
            <select
              value={rotationTimes}
              onChange={(event) => setRotationTimes(Number(event.target.value))}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-slate-400"
            >
              <option value={1}>轮转 1 条</option>
              <option value={2}>轮转 2 条</option>
              <option value={3}>轮转 3 条</option>
              <option value={4}>轮转 4 条</option>
              <option value={5}>轮转 5 条（默认）</option>
              <option value={6}>轮转 6 条</option>
              <option value={8}>轮转 8 条</option>
              <option value={10}>轮转 10 条</option>
            </select>
            <select
              value={rotationIntervalSec}
              onChange={(event) => setRotationIntervalSec(Number(event.target.value) as 0 | 3 | 5 | 10)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-slate-400"
            >
              <option value={0}>0 秒间隔</option>
              <option value={3}>3 秒间隔（默认）</option>
              <option value={5}>5 秒间隔</option>
              <option value={10}>10 秒间隔</option>
            </select>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${riskToneClass(rotationForecast.riskLevel)}`}>
                  风险 {rotationForecast.riskLevel === "high" ? "偏高" : rotationForecast.riskLevel === "medium" ? "中等" : "较低"}
                </span>
                <span>预计 {rotationForecast.targetMinutes} 分钟内完成，最慢不超过 {rotationForecast.limitMinutes} 分钟。</span>
              </div>
              <div className="mt-2 text-xs text-slate-500">
                <p>当前按 {selectedRotationAccountIds.length} 个账号、每号 {rotationTimes} 次轮转预估。</p>
                {rotationForecast.notes.map((note) => (
                  <p key={note}>{note}</p>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-sm font-medium text-slate-700">转发文案（每行一条，按顺序轮转）</p>
              <textarea
                value={rotationCopyTexts}
                onChange={(event) => setRotationCopyTexts(event.target.value)}
                className="min-h-28 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-slate-400"
                placeholder={"支持\n路过\n冲冲冲"}
              />
            </div>
            <p className="text-sm text-slate-500">
              可自行设置轮转次数；若填写文案，将按行轮转写入转发内容，全部由服务器真实执行。
            </p>
            <button
              type="submit"
              disabled={submitting || !canManage}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              开始轮转转发
            </button>
          </form>
        </section>
      )}

      <section className={`${mobileView === "CREATE" ? "hidden md:block " : ""}rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:p-6`}>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <h3 className="text-lg font-medium">最近任务</h3>
          <select
            value={jobStatusFilter}
            onChange={(event) => setJobStatusFilter(event.target.value as "ALL" | ActionJob["status"])}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-slate-400"
          >
            <option value="ALL">全部状态</option>
            <option value="RUNNING">仅运行中</option>
            <option value="PENDING">待执行</option>
            <option value="SUCCESS">成功</option>
            <option value="PARTIAL_FAILED">部分失败</option>
            <option value="FAILED">失败</option>
            <option value="CANCELLED">已取消</option>
          </select>
        </div>

        <div className="mt-4 space-y-3 md:hidden">
          {filteredJobs.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-sm text-slate-500">当前筛选下暂无任务记录。</div>
          ) : (
            filteredJobs.map((job) => {
              const expanded = expandedJobId === job.id;

              return (
                <article key={job.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-900">{getJobTypeText(job.jobType)}</p>
                      <p className="mt-1 text-xs text-slate-500">{new Date(job.createdAt).toLocaleString("zh-CN")}</p>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs">
                        <span className="rounded-full bg-white px-2.5 py-1 text-slate-700">{jobStatusText[job.status]}</span>
                        <span className="rounded-full bg-white px-2.5 py-1 text-slate-700">{getUrgencyText(getJobUrgency(job))}</span>
                        <span className="rounded-full bg-white px-2.5 py-1 text-slate-700">{job.accountRuns.length} 个账号</span>
                      </div>
                    </div>
                    {["PENDING", "RUNNING"].includes(job.status) ? (
                      <button onClick={() => handleStopJob(job.id)} className="rounded-lg border border-amber-200 px-3 py-2 text-sm font-medium text-amber-800">
                        停止
                      </button>
                    ) : null}
                  </div>

                  <div className="mt-3 rounded-xl bg-white p-3 text-sm text-slate-600">
                    {job.accountRuns.map((run) => `${run.account.nickname}:${jobStatusText[run.status]}`).join(" / ") || "-"}
                  </div>
                  <p className="mt-2 text-xs text-slate-500">{getJobSlaText(job)}</p>

                  <button
                    type="button"
                    onClick={() => toggleJobExpanded(job.id)}
                    className="mt-3 text-sm font-medium text-sky-700"
                  >
                    {expanded ? "收起明细" : "查看明细"}
                  </button>

                  {expanded ? (
                    <div className="mt-3 space-y-2">
                      {job.accountRuns.map((run) => (
                        <div key={run.id} className="rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700">
                          <div className="flex items-center justify-between gap-3">
                            <span className="font-medium">{run.account.nickname}</span>
                            <span>{jobStatusText[run.status]}</span>
                          </div>
                          <p className="mt-2 text-xs text-slate-500">
                            进度 {run.currentStep}/{run.totalSteps}
                          </p>
                          {run.errorMessage ? <p className="mt-1 text-xs text-rose-600">失败原因：{run.errorMessage}</p> : null}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </article>
              );
            })
          )}
        </div>

        <div className="mt-4 hidden overflow-x-auto md:block">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-3 py-2 font-medium">时间</th>
                <th className="px-3 py-2 font-medium">类型</th>
                <th className="px-3 py-2 font-medium">状态</th>
                <th className="px-3 py-2 font-medium">账号执行</th>
                <th className="px-3 py-2 font-medium">时效策略</th>
                <th className="px-3 py-2 font-medium">明细</th>
                <th className="px-3 py-2 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredJobs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-slate-500">
                    当前筛选下暂无任务记录。
                  </td>
                </tr>
              ) : (
                filteredJobs.flatMap((job) => {
                  const expanded = expandedJobId === job.id;

                  return [
                    <tr key={job.id} className="border-t border-slate-200 align-top">
                      <td className="px-3 py-3">{new Date(job.createdAt).toLocaleString("zh-CN")}</td>
                      <td className="px-3 py-3">{getJobTypeText(job.jobType)}</td>
                      <td className="px-3 py-3">{jobStatusText[job.status]}</td>
                      <td className="px-3 py-3">
                        {job.accountRuns.map((run) => `${run.account.nickname}:${jobStatusText[run.status]}`).join(" / ") || "-"}
                      </td>
                      <td className="px-3 py-3">
                        <p>{getUrgencyText(getJobUrgency(job))}</p>
                        <p className="mt-1 text-xs text-slate-500">{getJobSlaText(job)}</p>
                      </td>
                      <td className="px-3 py-3">
                        <button onClick={() => toggleJobExpanded(job.id)} className="text-sky-700 hover:text-sky-800">
                          {expanded ? "收起" : "展开"}
                        </button>
                      </td>
                      <td className="px-3 py-3">
                        {["PENDING", "RUNNING"].includes(job.status) ? (
                          <button onClick={() => handleStopJob(job.id)} className="text-amber-700 hover:text-amber-800">
                            停止
                          </button>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                    </tr>,
                    expanded ? (
                      <tr key={`${job.id}-details`} className="border-t border-slate-100 bg-slate-50">
                        <td colSpan={7} className="px-3 py-3">
                          <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                            {job.accountRuns.map((run) => (
                              <div key={run.id} className="rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700">
                                <div className="flex items-center justify-between gap-3">
                                  <span className="font-medium">{run.account.nickname}</span>
                                  <span>{jobStatusText[run.status]}</span>
                                </div>
                                <p className="mt-2 text-xs text-slate-500">
                                  进度 {run.currentStep}/{run.totalSteps}
                                </p>
                                {run.errorMessage ? <p className="mt-1 text-xs text-rose-600">失败原因：{run.errorMessage}</p> : null}
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ) : null,
                  ];
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
    </div>
  );
}
