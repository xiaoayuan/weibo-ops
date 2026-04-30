"use client";

import { useMemo, useState } from "react";

import { AppNotice } from "@/components/app-notice";
import type { CopywritingTemplate } from "@/lib/app-data";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { SectionHeader } from "@/components/section-header";
import { StatusBadge } from "@/components/status-badge";
import { SurfaceCard } from "@/components/surface-card";
import { TableShell } from "@/components/table-shell";

type FormState = {
  title: string;
  content: string;
  tags: string;
  firstComment: boolean;
  status: "ACTIVE" | "DISABLED";
};

const initialForm: FormState = {
  title: "",
  content: "",
  tags: "",
  firstComment: false,
  status: "ACTIVE",
};

function isAiCopywriting(item: CopywritingTemplate) {
  return item.tags.includes("AI生成");
}

function getCopywritingSourceText(item: CopywritingTemplate) {
  return isAiCopywriting(item) ? "AI" : "手动";
}

function getBusinessTypeFromTags(item: CopywritingTemplate) {
  if (item.tags.includes("业务:每日计划")) {
    return "DAILY_PLAN";
  }
  if (item.tags.includes("业务:一键回复")) {
    return "QUICK_REPLY";
  }
  if (item.tags.includes("业务:控评")) {
    return "COMMENT_CONTROL";
  }
  if (item.tags.includes("业务:轮转")) {
    return "REPOST_ROTATION";
  }

  return "ALL";
}

export function CopywritingManager({ initialItems }: { initialItems: CopywritingTemplate[] }) {
  const [items, setItems] = useState(initialItems);
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [sourceFilter, setSourceFilter] = useState<"ALL" | "MANUAL" | "AI">("ALL");
  const [businessFilter, setBusinessFilter] = useState<"ALL" | "DAILY_PLAN" | "QUICK_REPLY" | "COMMENT_CONTROL" | "REPOST_ROTATION">("ALL");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesSource = sourceFilter === "ALL" || (sourceFilter === "AI" ? isAiCopywriting(item) : !isAiCopywriting(item));
      const businessType = getBusinessTypeFromTags(item);
      const matchesBusiness = businessFilter === "ALL" || businessFilter === businessType;

      return matchesSource && matchesBusiness;
    });
  }, [businessFilter, items, sourceFilter]);

  function resetForm() {
    setEditingId(null);
    setForm(initialForm);
  }

  async function submitForm() {
    try {
      setSubmitting(true);
      setError(null);
      setNotice(null);

      const response = await fetch(editingId ? `/api/copywriting/${editingId}` : "/api/copywriting", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          content: form.content,
          tags: Array.from(
            new Set([
              ...form.tags
                .split(",")
                .map((item) => item.trim())
                .filter((item) => Boolean(item) && item !== "首评文案" && item !== "FIRST_COMMENT"),
              ...(form.firstComment ? ["首评文案"] : []),
            ]),
          ),
          status: form.status,
        }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || (editingId ? "更新文案失败" : "新增文案失败"));
      }

      setItems((current) =>
        editingId ? current.map((item) => (item.id === editingId ? result.data : item)) : [result.data, ...current],
      );
      setNotice(editingId ? "文案已更新" : "文案已创建");
      resetForm();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : editingId ? "更新文案失败" : "新增文案失败");
    } finally {
      setSubmitting(false);
    }
  }

  async function removeItem(id: string) {
    if (!window.confirm("确认删除这条文案吗？")) {
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      setNotice(null);

      const response = await fetch(`/api/copywriting/${id}`, { method: "DELETE" });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "删除文案失败");
      }

      setItems((current) => current.filter((item) => item.id !== id));
      setNotice(result.message || "删除成功");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "删除文案失败");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6 lg:space-y-8">
      <PageHeader eyebrow="文案库" title="先迁手动文案管理，再逐步接回 AI 工作流" description="这一轮先把可直接影响日常运营的手动文案维护迁到独立前端，包括创建、编辑、删除和基础筛选。AI 生成与风控面板下一轮再精细接入。" />

      <SurfaceCard>
        <SectionHeader title={editingId ? "编辑文案" : "新增文案"} />
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} className="app-input" placeholder="标题" />
          <input value={form.tags} onChange={(event) => setForm((current) => ({ ...current, tags: event.target.value }))} className="app-input" placeholder="标签，多个用英文逗号分隔" />
          <textarea value={form.content} onChange={(event) => setForm((current) => ({ ...current, content: event.target.value }))} className="app-input min-h-[168px] resize-y py-3 md:col-span-2" placeholder="文案内容" />
          <label className="flex items-center gap-3 rounded-[16px] border border-app-line bg-app-panel-muted px-4 py-3 text-sm text-app-text-soft">
            <input type="checkbox" checked={form.firstComment} onChange={(event) => setForm((current) => ({ ...current, firstComment: event.target.checked }))} />
            标记为首评文案
          </label>
          <select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as FormState["status"] }))} className="app-input">
            <option value="ACTIVE">启用</option>
            <option value="DISABLED">停用</option>
          </select>
        </div>

        {error ? <AppNotice tone="error" className="mt-4">{error}</AppNotice> : null}
        {notice ? <AppNotice tone="success" className="mt-4">{notice}</AppNotice> : null}

        <div className="mt-5 flex flex-wrap justify-end gap-3">
          {editingId ? (
            <button type="button" onClick={resetForm} className="app-button app-button-secondary">
              取消编辑
            </button>
          ) : null}
          <button type="button" onClick={() => void submitForm()} disabled={submitting} className="app-button app-button-primary">
            {editingId ? "保存修改" : "新增文案"}
          </button>
        </div>
      </SurfaceCard>

      <SurfaceCard>
        <SectionHeader
          title="文案列表"
          action={
            <div className="flex flex-col gap-3 md:flex-row">
              <select value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value as "ALL" | "MANUAL" | "AI")} className="app-input md:w-[180px]">
                <option value="ALL">全部来源</option>
                <option value="MANUAL">手动</option>
                <option value="AI">AI</option>
              </select>
              <select value={businessFilter} onChange={(event) => setBusinessFilter(event.target.value as typeof businessFilter)} className="app-input md:w-[220px]">
                <option value="ALL">全部业务</option>
                <option value="DAILY_PLAN">每日计划</option>
                <option value="QUICK_REPLY">一键回复</option>
                <option value="COMMENT_CONTROL">控评</option>
                <option value="REPOST_ROTATION">轮转</option>
              </select>
            </div>
          }
        />

        {filteredItems.length === 0 ? (
          <div className="mt-5">
            <EmptyState title="暂无文案" description="当前筛选下没有文案。你可以先新增一条，或者切换筛选条件。" />
          </div>
        ) : (
          <TableShell className="mt-5">
            <table className="app-table min-w-[1180px]">
              <thead>
                <tr>
                  <th>标题</th>
                  <th>内容预览</th>
                  <th>标签</th>
                  <th>来源</th>
                  <th>状态</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => (
                  <tr key={item.id}>
                    <td className="font-medium text-app-text-strong">{item.title}</td>
                    <td className="max-w-[340px] text-sm leading-7 text-app-text-muted">{item.content}</td>
                    <td>
                      <div className="flex max-w-[220px] flex-wrap gap-2">
                        {item.tags.length > 0 ? item.tags.map((tag) => <span key={tag} className="app-chip">{tag}</span>) : <span className="text-app-text-soft">-</span>}
                      </div>
                    </td>
                    <td>{getCopywritingSourceText(item)}</td>
                    <td>
                      <StatusBadge tone={item.status === "ACTIVE" ? "success" : "neutral"}>{item.status === "ACTIVE" ? "启用" : "停用"}</StatusBadge>
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(item.id);
                            setForm({
                              title: item.title,
                              content: item.content,
                              tags: item.tags.join(", "),
                              firstComment: item.tags.includes("首评文案") || item.tags.includes("FIRST_COMMENT"),
                              status: item.status as FormState["status"],
                            });
                          }}
                          className="app-button app-button-secondary h-10 px-4 text-xs"
                        >
                          编辑
                        </button>
                        <button type="button" onClick={() => void removeItem(item.id)} disabled={submitting} className="app-button app-button-secondary h-10 px-4 text-xs text-app-danger hover:border-app-danger/30 hover:text-app-danger">
                          删除
                        </button>
                      </div>
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
