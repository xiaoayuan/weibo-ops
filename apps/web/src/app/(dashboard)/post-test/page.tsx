"use client";

import { useState } from "react";

import { AppNotice } from "@/components/app-notice";
import { PageHeader } from "@/components/page-header";
import { SurfaceCard } from "@/components/surface-card";
import type { SuperTopic, WeiboAccount } from "@/lib/app-data";
import { requireSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function PostTestPage() {
  await requireSession();

  // 直接在这里 fetch 数据（服务端组件中）
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3007";

  let accounts: WeiboAccount[] = [];
  let topics: SuperTopic[] = [];

  try {
    const sessionRes = await fetch(`${baseUrl}/api/auth/session`, { cache: "no-store" });
    if (sessionRes.ok) {
      const session = await sessionRes.json();
      if (session?.user?.id) {
        const [accountsRes, topicsRes] = await Promise.all([
          fetch(`${baseUrl}/api/accounts`, { cache: "no-store" }),
          fetch(`${baseUrl}/api/super-topics`, { cache: "no-store" }),
        ]);
        if (accountsRes.ok) {
          const accountsData = await accountsRes.json();
          accounts = (accountsData.payload?.data ?? []).filter(
            (a: WeiboAccount) => a.ownerUserId === session.user.id,
          );
        }
        if (topicsRes.ok) {
          const topicsData = await topicsRes.json();
          topics = topicsData.payload?.data ?? [];
        }
      }
    }
  } catch {
    // 忽略错误
  }

  return <PostTestClient accounts={accounts} topics={topics} />;
}

function PostTestClient({
  accounts,
  topics,
}: {
  accounts: WeiboAccount[];
  topics: SuperTopic[];
}) {
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [selectedTopicId, setSelectedTopicId] = useState("");
  const [customTopicUrl, setCustomTopicUrl] = useState("");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string; data?: unknown } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!selectedAccountId) {
      setError("请先选择一个账号");
      return;
    }
    if (!content.trim()) {
      setError("请输入发帖内容");
      return;
    }
    if (!selectedTopicId && !customTopicUrl.trim()) {
      setError("请选择超话或输入发帖链接");
      return;
    }

    setSubmitting(true);
    setError(null);
    setResult(null);

    try {
      const body: Record<string, string> = {
        accountId: selectedAccountId,
        content: content.trim(),
      };

      if (selectedTopicId) {
        body.superTopicId = selectedTopicId;
      }
      if (customTopicUrl.trim()) {
        body.topicUrl = customTopicUrl.trim();
      }

      const response = await fetch("/api/test-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();

      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "请求失败");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6 lg:space-y-8">
      <PageHeader
        title="发帖测试"
        description="绕过每日计划，直接用指定账号和超话发一条帖子，验证发帖链路是否正常。"
      />

      <SurfaceCard>
        <div className="space-y-5">
          {/* 账号选择 */}
          <div>
            <label className="mb-2 block text-sm font-medium text-app-text-soft">选择账号</label>
            <select
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
              className="app-input h-12 w-full"
            >
              <option value="">请选择账号</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.nickname}（{account.loginStatus === "ONLINE" ? "在线" : account.loginStatus === "EXPIRED" ? "过期" : "未知"}）
                </option>
              ))}
            </select>
          </div>

          {/* 超话选择 */}
          <div>
            <label className="mb-2 block text-sm font-medium text-app-text-soft">选择超话</label>
            <select
              value={selectedTopicId}
              onChange={(e) => {
                setSelectedTopicId(e.target.value);
                setCustomTopicUrl("");
              }}
              className="app-input h-12 w-full"
            >
              <option value="">请选择超话</option>
              {topics.map((topic) => (
                <option key={topic.id} value={topic.id}>
                  {topic.name}
                </option>
              ))}
            </select>
          </div>

          {/* 自定义发帖链接 */}
          <div>
            <label className="mb-2 block text-sm font-medium text-app-text-soft">或输入发帖链接（优先）</label>
            <input
              value={customTopicUrl}
              onChange={(e) => {
                setCustomTopicUrl(e.target.value);
                if (e.target.value) setSelectedTopicId("");
              }}
              className="app-input h-12 w-full"
              placeholder="https://weibo.com/page/...（用于指定板块发帖）"
            />
          </div>

          {/* 发帖内容 */}
          <div>
            <label className="mb-2 block text-sm font-medium text-app-text-soft">发帖内容</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={5}
              className="app-input w-full resize-none px-4 py-3"
              placeholder="输入你想发送的内容..."
            />
          </div>

          {error ? <AppNotice tone="error">{error}</AppNotice> : null}

          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={submitting}
            className="app-button app-button-primary h-12 w-full text-base"
          >
            {submitting ? "发帖中..." : "立即发帖测试"}
          </button>
        </div>
      </SurfaceCard>

      {/* 结果展示 */}
      {result ? (
        <SurfaceCard>
          <h3 className="mb-4 text-lg font-semibold text-app-text-strong">执行结果</h3>
          <div className={`rounded-[16px] border p-4 ${result.success ? "border-app-success/30 bg-app-success/8" : "border-app-danger/30 bg-app-danger/8"}`}>
            <p className={`text-base font-semibold ${result.success ? "text-app-success" : "text-app-danger"}`}>
              {result.success ? "✓ 发帖成功" : "✗ 发帖失败"}
            </p>
            <p className="mt-2 text-sm text-app-text-muted">{result.message}</p>
          </div>
        </SurfaceCard>
      ) : null}
    </div>
  );
}