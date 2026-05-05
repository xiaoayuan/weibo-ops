"use client";

import { useMemo, useState } from "react";

import { AppNotice } from "@/components/app-notice";
import type { SuperTopic } from "@/lib/app-data";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { SectionHeader } from "@/components/section-header";
import { SurfaceCard } from "@/components/surface-card";
import { TableShell } from "@/components/table-shell";

type FormState = {
  name: string;
  boardName: string;
  topicUrl: string;
  postingUrl: string;
};

const initialForm: FormState = {
  name: "",
  boardName: "",
  topicUrl: "",
  postingUrl: "",
};

export function SuperTopicsManager({ initialTopics }: { initialTopics: SuperTopic[] }) {
  const [topics, setTopics] = useState(initialTopics);
  const [form, setForm] = useState<FormState>(initialForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [keyword, setKeyword] = useState("");
  const [boardFilter, setBoardFilter] = useState("ALL");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const boardOptions = useMemo(
    () => Array.from(new Set(topics.map((topic) => topic.boardName?.trim()).filter(Boolean))) as string[],
    [topics],
  );

  const filteredTopics = topics.filter((topic) => {
    const normalized = keyword.trim().toLowerCase();
    const matchesKeyword =
      normalized === "" ||
      topic.name.toLowerCase().includes(normalized) ||
      (topic.boardName || "").toLowerCase().includes(normalized);
    const matchesBoard = boardFilter === "ALL" || (topic.boardName || "") === boardFilter;

    return matchesKeyword && matchesBoard;
  });

  function resetForm() {
    setEditingId(null);
    setForm(initialForm);
  }

  async function submitForm() {
    try {
      setSubmitting(true);
      setError(null);
      setNotice(null);

      const response = await fetch(editingId ? `/api/super-topics/${editingId}` : "/api/super-topics", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || (editingId ? "更新超话失败" : "新增超话失败"));
      }

      setTopics((current) =>
        editingId ? current.map((item) => (item.id === editingId ? result.data : item)) : [result.data, ...current],
      );
      setNotice(editingId ? "超话已更新" : "超话已创建");
      resetForm();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : editingId ? "更新超话失败" : "新增超话失败");
    } finally {
      setSubmitting(false);
    }
  }

  async function removeTopic(id: string) {
    if (!window.confirm("确认删除这个超话吗？")) {
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      setNotice(null);

      const response = await fetch(`/api/super-topics/${id}`, { method: "DELETE" });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "删除超话失败");
      }

      setTopics((current) => current.filter((item) => item.id !== id));
      setNotice(result.message || "删除成功");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "删除超话失败");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6 lg:space-y-8">
      <PageHeader title="超话管理" description="管理超话名称、板块和入口链接等基础信息。" />

      <SurfaceCard>
        <SectionHeader title={editingId ? "编辑超话" : "新增超话"} />
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} className="app-input" placeholder="超话名称" />
          <input value={form.boardName} onChange={(event) => setForm((current) => ({ ...current, boardName: event.target.value }))} className="app-input" placeholder="板块名称" />
          <input value={form.topicUrl} onChange={(event) => setForm((current) => ({ ...current, topicUrl: event.target.value }))} className="app-input md:col-span-2" placeholder="超话链接（签到用）" />
          <input value={form.postingUrl} onChange={(event) => setForm((current) => ({ ...current, postingUrl: event.target.value }))} className="app-input md:col-span-2" placeholder="发帖链接（指定板块发帖用，可留空）" />
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
            {editingId ? "保存修改" : "新增超话"}
          </button>
        </div>
      </SurfaceCard>

      <SurfaceCard>
        <SectionHeader
          title="超话列表"
          action={
            <div className="flex flex-col gap-3 md:flex-row">
              <input value={keyword} onChange={(event) => setKeyword(event.target.value)} className="app-input md:w-[240px]" placeholder="搜索超话或板块" />
              <select value={boardFilter} onChange={(event) => setBoardFilter(event.target.value)} className="app-input md:w-[220px]">
                <option value="ALL">全部板块</option>
                {boardOptions.map((board) => (
                  <option key={board} value={board}>
                    {board}
                  </option>
                ))}
              </select>
            </div>
          }
        />

        {filteredTopics.length === 0 ? (
          <div className="mt-5">
            <EmptyState title="暂无超话" description="当前筛选下没有可见超话。你可以先新增一条，或切换筛选条件。" />
          </div>
        ) : (
          <TableShell className="mt-5">
            <table className="app-table min-w-[980px]">
              <thead>
                <tr>
                  <th>超话名称</th>
                  <th>板块</th>
                  <th>链接</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredTopics.map((topic) => (
                  <tr key={topic.id}>
                    <td className="font-medium text-app-text-strong">{topic.name}</td>
                    <td>{topic.boardName || "-"}</td>
                    <td>
                      {topic.topicUrl ? (
                        <a href={topic.topicUrl} target="_blank" rel="noreferrer" className="text-app-accent-strong transition hover:text-app-text-strong">
                          打开链接
                        </a>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(topic.id);
                            setForm({
                              name: topic.name,
                              boardName: topic.boardName || "",
                              topicUrl: topic.topicUrl || "",
                              postingUrl: topic.postingUrl || "",
                            });
                          }}
                          className="app-button app-button-secondary h-10 px-4 text-xs"
                        >
                          编辑
                        </button>
                        <button type="button" onClick={() => void removeTopic(topic.id)} disabled={submitting} className="app-button app-button-secondary h-10 px-4 text-xs text-app-danger hover:border-app-danger/30 hover:text-app-danger">
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
