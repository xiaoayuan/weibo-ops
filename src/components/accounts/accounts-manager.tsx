"use client";

import type { WeiboAccount } from "@/generated/prisma/client";
import { FormEvent, useState } from "react";

type AccountStatus = "ACTIVE" | "DISABLED" | "RISKY" | "EXPIRED";

type FormState = {
  nickname: string;
  remark: string;
  groupName: string;
  status: AccountStatus;
};

const initialForm: FormState = {
  nickname: "",
  remark: "",
  groupName: "",
  status: "ACTIVE",
};

const statusText: Record<AccountStatus, string> = {
  ACTIVE: "正常",
  DISABLED: "停用",
  RISKY: "风险",
  EXPIRED: "失效",
};

export function AccountsManager({ initialAccounts }: { initialAccounts: WeiboAccount[] }) {
  const [accounts, setAccounts] = useState(initialAccounts);
  const [form, setForm] = useState<FormState>(initialForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [keyword, setKeyword] = useState("");
  const [groupFilter, setGroupFilter] = useState("ALL");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const groupOptions = Array.from(new Set(accounts.map((account) => account.groupName?.trim()).filter(Boolean))) as string[];
  const filteredAccounts = accounts.filter((account) => {
    const matchesKeyword =
      keyword.trim() === "" ||
      account.nickname.toLowerCase().includes(keyword.trim().toLowerCase()) ||
      (account.remark || "").toLowerCase().includes(keyword.trim().toLowerCase());
    const matchesGroup = groupFilter === "ALL" || (account.groupName || "") === groupFilter;

    return matchesKeyword && matchesGroup;
  });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setSubmitting(true);
      setError(null);

      const response = await fetch(editingId ? `/api/accounts/${editingId}` : "/api/accounts", {
        method: editingId ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "新增账号失败");
      }

      setForm(initialForm);
      setEditingId(null);

      setAccounts((current) =>
        editingId
          ? current.map((item) => (item.id === editingId ? result.data : item))
          : [result.data, ...current],
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : editingId ? "更新账号失败" : "新增账号失败");
    } finally {
      setSubmitting(false);
    }
  }

  function handleEdit(account: WeiboAccount) {
    setEditingId(account.id);
    setForm({
      nickname: account.nickname,
      remark: account.remark || "",
      groupName: account.groupName || "",
      status: account.status,
    });
    setError(null);
  }

  function handleCancelEdit() {
    setEditingId(null);
    setForm(initialForm);
    setError(null);
  }

  async function handleDelete(id: string) {
    const confirmed = window.confirm("确认删除这个账号吗？");

    if (!confirmed) {
      return;
    }

    try {
      setError(null);

      const response = await fetch(`/api/accounts/${id}`, {
        method: "DELETE",
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "删除账号失败");
      }

      setAccounts((current) => current.filter((item) => item.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除账号失败");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">账号管理</h2>
        <p className="mt-1 text-sm text-slate-500">管理微博账号、分组和风险状态。</p>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-medium">{editingId ? "编辑账号" : "新增账号"}</h3>

        <form className="mt-4 grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">账号昵称</label>
            <input
              value={form.nickname}
              onChange={(event) => setForm((current) => ({ ...current, nickname: event.target.value }))}
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-slate-400"
              placeholder="请输入账号昵称"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">分组</label>
            <input
              value={form.groupName}
              onChange={(event) => setForm((current) => ({ ...current, groupName: event.target.value }))}
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-slate-400"
              placeholder="默认分组"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">备注</label>
            <input
              value={form.remark}
              onChange={(event) => setForm((current) => ({ ...current, remark: event.target.value }))}
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-slate-400"
              placeholder="例如：娱乐组"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">状态</label>
            <select
              value={form.status}
              onChange={(event) =>
                setForm((current) => ({ ...current, status: event.target.value as AccountStatus }))
              }
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-slate-400"
            >
              <option value="ACTIVE">正常</option>
              <option value="DISABLED">停用</option>
              <option value="RISKY">风险</option>
              <option value="EXPIRED">失效</option>
            </select>
          </div>

          <div className="md:col-span-2 flex items-center justify-between gap-3">
            {error ? <p className="text-sm text-rose-600">{error}</p> : <div />}

            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "提交中..." : editingId ? "保存修改" : "新增账号"}
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
        </form>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <h3 className="text-lg font-medium">账号列表</h3>
            <div className="flex flex-col gap-3 md:flex-row">
              <input
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                placeholder="搜索昵称或备注"
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-slate-400"
              />
              <select
                value={groupFilter}
                onChange={(event) => setGroupFilter(event.target.value)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-slate-400"
              >
                <option value="ALL">全部分组</option>
                {groupOptions.map((group) => (
                  <option key={group} value={group}>
                    {group}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {filteredAccounts.length === 0 ? (
          <div className="px-6 py-8 text-sm text-slate-500">暂无账号，先新增一条账号记录。</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-6 py-3 font-medium">账号昵称</th>
                  <th className="px-6 py-3 font-medium">分组</th>
                  <th className="px-6 py-3 font-medium">备注</th>
                  <th className="px-6 py-3 font-medium">状态</th>
                  <th className="px-6 py-3 font-medium">风险等级</th>
                  <th className="px-6 py-3 font-medium">创建时间</th>
                  <th className="px-6 py-3 font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredAccounts.map((account) => (
                  <tr key={account.id} className="border-t border-slate-200">
                    <td className="px-6 py-4">{account.nickname}</td>
                    <td className="px-6 py-4">{account.groupName || "-"}</td>
                    <td className="px-6 py-4">{account.remark || "-"}</td>
                    <td className="px-6 py-4">{statusText[account.status]}</td>
                    <td className="px-6 py-4">{account.riskLevel}</td>
                    <td className="px-6 py-4">{new Date(account.createdAt).toLocaleString("zh-CN")}</td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleEdit(account)}
                        className="mr-4 text-sm text-sky-600 transition hover:text-sky-700"
                      >
                        编辑
                      </button>
                      <button
                        onClick={() => handleDelete(account.id)}
                        className="text-sm text-rose-600 transition hover:text-rose-700"
                      >
                        删除
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
