"use client";

import type { CopywritingTemplate } from "@/generated/prisma/client";
import { FormEvent, useState } from "react";

type FormState = {
  title: string;
  content: string;
  tags: string;
  status: "ACTIVE" | "DISABLED";
};

const initialForm: FormState = {
  title: "",
  content: "",
  tags: "",
  status: "ACTIVE",
};

export function CopywritingManager({ initialItems }: { initialItems: CopywritingTemplate[] }) {
  const [items, setItems] = useState(initialItems);
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setSubmitting(true);
      setError(null);

      const response = await fetch(editingId ? `/api/copywriting/${editingId}` : "/api/copywriting", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          content: form.content,
          tags: form.tags.split(",").map((item) => item.trim()).filter(Boolean),
          status: form.status,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "新增文案失败");
      }

      setItems((current) =>
        editingId
          ? current.map((item) => (item.id === editingId ? result.data : item))
          : [result.data, ...current],
      );
      setEditingId(null);
      setForm(initialForm);
    } catch (err) {
      setError(err instanceof Error ? err.message : editingId ? "更新文案失败" : "新增文案失败");
    } finally {
      setSubmitting(false);
    }
  }

  function handleEdit(item: CopywritingTemplate) {
    setEditingId(item.id);
    setForm({
      title: item.title,
      content: item.content,
      tags: item.tags.join(", "),
      status: item.status,
    });
    setError(null);
  }

  function handleCancelEdit() {
    setEditingId(null);
    setForm(initialForm);
    setError(null);
  }

  async function handleDelete(id: string) {
    if (!window.confirm("确认删除这条文案吗？")) {
      return;
    }

    try {
      setError(null);
      const response = await fetch(`/api/copywriting/${id}`, { method: "DELETE" });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "删除文案失败");
      }

      setItems((current) => current.filter((item) => item.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除文案失败");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">文案库</h2>
        <p className="mt-1 text-sm text-slate-500">维护发帖文案、标签和启用状态。</p>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-medium">{editingId ? "编辑文案" : "新增文案"}</h3>
        <form className="mt-4 grid gap-4" onSubmit={handleSubmit}>
          <input
            value={form.title}
            onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
            className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-slate-400"
            placeholder="文案标题"
          />
          <textarea
            value={form.content}
            onChange={(event) => setForm((current) => ({ ...current, content: event.target.value }))}
            className="min-h-28 rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-slate-400"
            placeholder="文案内容"
          />
          <div className="grid gap-4 md:grid-cols-[1fr_180px]">
            <input
              value={form.tags}
              onChange={(event) => setForm((current) => ({ ...current, tags: event.target.value }))}
              className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-slate-400"
              placeholder="标签，逗号分隔"
            />
            <select
              value={form.status}
              onChange={(event) =>
                setForm((current) => ({ ...current, status: event.target.value as FormState["status"] }))
              }
              className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-slate-400"
            >
              <option value="ACTIVE">启用</option>
              <option value="DISABLED">停用</option>
            </select>
          </div>
          <div className="flex items-center justify-between gap-3">
            {error ? <p className="text-sm text-rose-600">{error}</p> : <div />}
            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={submitting}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? "提交中..." : editingId ? "保存修改" : "新增文案"}
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

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="px-6 py-3 font-medium">标题</th>
              <th className="px-6 py-3 font-medium">内容</th>
              <th className="px-6 py-3 font-medium">标签</th>
              <th className="px-6 py-3 font-medium">状态</th>
              <th className="px-6 py-3 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-slate-500">
                  暂无文案，先新增一条内容。
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id} className="border-t border-slate-200 align-top">
                  <td className="px-6 py-4">{item.title}</td>
                  <td className="max-w-xl px-6 py-4 text-slate-600">{item.content}</td>
                  <td className="px-6 py-4">{item.tags.join("、") || "-"}</td>
                  <td className="px-6 py-4">{item.status === "ACTIVE" ? "启用" : "停用"}</td>
                  <td className="px-6 py-4">
                    <button onClick={() => handleEdit(item)} className="mr-4 text-sky-600 hover:text-sky-700">
                      编辑
                    </button>
                    <button onClick={() => handleDelete(item.id)} className="text-rose-600 hover:text-rose-700">
                      删除
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
