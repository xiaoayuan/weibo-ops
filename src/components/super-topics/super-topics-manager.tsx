"use client";

import type { SuperTopic } from "@/generated/prisma/client";
import { canManageBusinessData } from "@/lib/permission-rules";
import type { AppRole } from "@/lib/permission-rules";
import { FormEvent, useState } from "react";

type FormState = {
  name: string;
  boardName: string;
  topicUrl: string;
};

const initialForm: FormState = {
  name: "",
  boardName: "",
  topicUrl: "",
};

export function SuperTopicsManager({ currentUserRole, initialTopics }: { currentUserRole: AppRole; initialTopics: SuperTopic[] }) {
  const [topics, setTopics] = useState(initialTopics);
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [keyword, setKeyword] = useState("");
  const [boardFilter, setBoardFilter] = useState("ALL");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canManage = canManageBusinessData(currentUserRole);

  const boardOptions = Array.from(new Set(topics.map((topic) => topic.boardName?.trim()).filter(Boolean))) as string[];
  const filteredTopics = topics.filter((topic) => {
    const matchesKeyword =
      keyword.trim() === "" ||
      topic.name.toLowerCase().includes(keyword.trim().toLowerCase()) ||
      (topic.boardName || "").toLowerCase().includes(keyword.trim().toLowerCase());
    const matchesBoard = boardFilter === "ALL" || (topic.boardName || "") === boardFilter;

    return matchesKeyword && matchesBoard;
  });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setSubmitting(true);
      setError(null);

      const response = await fetch(editingId ? `/api/super-topics/${editingId}` : "/api/super-topics", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "新增超话失败");
      }

      setTopics((current) =>
        editingId
          ? current.map((item) => (item.id === editingId ? result.data : item))
          : [result.data, ...current],
      );
      setEditingId(null);
      setForm(initialForm);
    } catch (err) {
      setError(err instanceof Error ? err.message : editingId ? "更新超话失败" : "新增超话失败");
    } finally {
      setSubmitting(false);
    }
  }

  function handleEdit(topic: SuperTopic) {
    setEditingId(topic.id);
    setForm({
      name: topic.name,
      boardName: topic.boardName || "",
      topicUrl: topic.topicUrl || "",
    });
    setError(null);
  }

  function handleCancelEdit() {
    setEditingId(null);
    setForm(initialForm);
    setError(null);
  }

  async function handleDelete(id: string) {
    if (!window.confirm("确认删除这个超话吗？")) {
      return;
    }

    try {
      setError(null);

      const response = await fetch(`/api/super-topics/${id}`, { method: "DELETE" });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "删除超话失败");
      }

      setTopics((current) => current.filter((item) => item.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除超话失败");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">超话管理</h2>
        <p className="mt-1 text-sm text-slate-500">维护超话名称、板块信息和跳转链接。</p>
      </div>

      {canManage ? (
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-medium">{editingId ? "编辑超话" : "新增超话"}</h3>
          <form className="mt-4 grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
          <input
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-slate-400"
            placeholder="超话名称"
          />
          <input
            value={form.boardName}
            onChange={(event) => setForm((current) => ({ ...current, boardName: event.target.value }))}
            className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-slate-400"
            placeholder="板块名称"
          />
          <input
            value={form.topicUrl}
            onChange={(event) => setForm((current) => ({ ...current, topicUrl: event.target.value }))}
            className="md:col-span-2 rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-slate-400"
            placeholder="超话链接"
          />
          <div className="md:col-span-2 flex items-center justify-between gap-3">
            {error ? <p className="text-sm text-rose-600">{error}</p> : <div />}
            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={submitting}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? "提交中..." : editingId ? "保存修改" : "新增超话"}
              </button>
              {editingId ? (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                >
                  取消编辑
                </button>
              ) : null}
            </div>
          </div>
          </form>
        </section>
      ) : null}

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <h3 className="text-lg font-medium">超话列表</h3>
            <div className="flex flex-col gap-3 md:flex-row">
              <input
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                placeholder="搜索超话或板块"
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-slate-400"
              />
              <select
                value={boardFilter}
                onChange={(event) => setBoardFilter(event.target.value)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-slate-400"
              >
                <option value="ALL">全部板块</option>
                {boardOptions.map((board) => (
                  <option key={board} value={board}>
                    {board}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="px-6 py-3 font-medium">超话名称</th>
              <th className="px-6 py-3 font-medium">板块</th>
              <th className="px-6 py-3 font-medium">链接</th>
               {canManage ? <th className="px-6 py-3 font-medium">操作</th> : null}
             </tr>
           </thead>
           <tbody>
             {filteredTopics.length === 0 ? (
               <tr>
                 <td colSpan={canManage ? 4 : 3} className="px-6 py-8 text-slate-500">
                   暂无超话，先新增一条记录。
                 </td>
               </tr>
            ) : (
              filteredTopics.map((topic) => (
                <tr key={topic.id} className="border-t border-slate-200">
                  <td className="px-6 py-4">{topic.name}</td>
                  <td className="px-6 py-4">{topic.boardName || "-"}</td>
                  <td className="px-6 py-4">
                    {topic.topicUrl ? (
                      <a href={topic.topicUrl} target="_blank" rel="noreferrer" className="text-sky-600 hover:text-sky-700">
                        打开链接
                      </a>
                    ) : (
                      "-"
                    )}
                  </td>
                  {canManage ? (
                    <td className="px-6 py-4">
                      <button onClick={() => handleEdit(topic)} className="mr-4 text-sky-600 hover:text-sky-700">
                        编辑
                      </button>
                      <button onClick={() => handleDelete(topic.id)} className="text-rose-600 hover:text-rose-700">
                        删除
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
