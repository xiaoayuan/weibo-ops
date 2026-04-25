"use client";

import { useMemo, useState } from "react";

type ProxyNodeItem = {
  id: string;
  name: string;
  host: string;
  port: number;
  countryCode: string | null;
  enabled: boolean;
};

type AccountBindingItem = {
  id: string;
  nickname: string;
  groupName: string | null;
  status: "ACTIVE" | "DISABLED" | "RISKY" | "EXPIRED";
  proxyNodeId: string | null;
  backupProxyNodeId: string | null;
  fallbackProxyNodeId: string | null;
  proxyBindingMode: "AUTO" | "MANUAL";
  proxyBindingLocked: boolean;
  allowHostFallback: boolean;
};

type Props = {
  initialNodes: ProxyNodeItem[];
  initialAccounts: AccountBindingItem[];
};

type DraftState = {
  proxyNodeId: string;
  backupProxyNodeId: string;
  fallbackProxyNodeId: string;
  proxyBindingMode: "AUTO" | "MANUAL";
  proxyBindingLocked: boolean;
  allowHostFallback: boolean;
};

function normalizeDraft(account: AccountBindingItem): DraftState {
  return {
    proxyNodeId: account.proxyNodeId || "",
    backupProxyNodeId: account.backupProxyNodeId || "",
    fallbackProxyNodeId: account.fallbackProxyNodeId || "",
    proxyBindingMode: account.proxyBindingMode,
    proxyBindingLocked: account.proxyBindingLocked,
    allowHostFallback: account.allowHostFallback,
  };
}

export function ProxyBindingManager({ initialNodes, initialAccounts }: Props) {
  const [accounts, setAccounts] = useState(initialAccounts);
  const [keyword, setKeyword] = useState("");
  const [drafts, setDrafts] = useState<Record<string, DraftState>>(() =>
    Object.fromEntries(initialAccounts.map((account) => [account.id, normalizeDraft(account)])),
  );
  const [savingId, setSavingId] = useState<string | null>(null);
  const [submittingAutoAssign, setSubmittingAutoAssign] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const nodeOptions = useMemo(
    () => [
      { value: "", label: "未设置" },
      ...initialNodes.map((node) => ({
        value: node.id,
        label: `${node.name} (${node.countryCode || "--"}) ${node.host}:${node.port}`,
      })),
    ],
    [initialNodes],
  );

  const filteredAccounts = useMemo(() => {
    const normalized = keyword.trim().toLowerCase();

    if (!normalized) {
      return accounts;
    }

    return accounts.filter((account) => {
      return (
        account.nickname.toLowerCase().includes(normalized) ||
        (account.groupName || "").toLowerCase().includes(normalized)
      );
    });
  }, [accounts, keyword]);

  function updateDraft(accountId: string, updater: (draft: DraftState) => DraftState) {
    setDrafts((current) => ({
      ...current,
      [accountId]: updater(current[accountId] || normalizeDraft(accounts.find((item) => item.id === accountId)!)),
    }));
  }

  async function reloadFromServer() {
    const response = await fetch("/api/proxy-bindings", { cache: "no-store" });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || "刷新绑定数据失败");
    }

    setAccounts(result.data.accounts);
    setDrafts(Object.fromEntries(result.data.accounts.map((account: AccountBindingItem) => [account.id, normalizeDraft(account)])));
  }

  async function handleSave(accountId: string) {
    const draft = drafts[accountId];

    if (!draft) {
      return;
    }

    try {
      setSavingId(accountId);
      setError(null);
      setNotice(null);

      const response = await fetch(`/api/proxy-bindings/${accountId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proxyNodeId: draft.proxyNodeId || null,
          backupProxyNodeId: draft.backupProxyNodeId || null,
          fallbackProxyNodeId: draft.fallbackProxyNodeId || null,
          proxyBindingMode: draft.proxyBindingMode,
          proxyBindingLocked: draft.proxyBindingLocked,
          allowHostFallback: draft.allowHostFallback,
        }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "保存绑定失败");
      }

      setNotice("账号代理绑定已保存");
      setAccounts((current) =>
        current.map((account) =>
          account.id === accountId
            ? {
                ...account,
                ...result.data,
              }
            : account,
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存绑定失败");
    } finally {
      setSavingId(null);
    }
  }

  async function handleAutoAssign() {
    try {
      setSubmittingAutoAssign(true);
      setError(null);
      setNotice(null);

      const response = await fetch("/api/proxy-bindings/auto-assign", { method: "POST" });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "自动绑定失败");
      }

      await reloadFromServer();
      setNotice(result.message || "自动绑定完成");
    } catch (err) {
      setError(err instanceof Error ? err.message : "自动绑定失败");
    } finally {
      setSubmittingAutoAssign(false);
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-medium">账号代理绑定</h3>
          <p className="mt-1 text-sm text-slate-500">默认自动绑定，支持按账号手动锁定主备代理，全部失败时可切主机 IP 兜底。</p>
        </div>
        <button
          type="button"
          onClick={handleAutoAssign}
          disabled={submittingAutoAssign}
          className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submittingAutoAssign ? "自动绑定中..." : "自动绑定(仅AUTO账号)"}
        </button>
      </div>

      <div className="mt-4">
        <input
          type="text"
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-slate-400"
          placeholder="搜索账号昵称或分组"
        />
      </div>

      {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}
      {notice ? <p className="mt-3 text-sm text-emerald-700">{notice}</p> : null}

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[1280px] text-left text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="px-3 py-2 font-medium">账号</th>
              <th className="px-3 py-2 font-medium">主代理</th>
              <th className="px-3 py-2 font-medium">备代理1</th>
              <th className="px-3 py-2 font-medium">备代理2</th>
              <th className="px-3 py-2 font-medium">模式</th>
              <th className="px-3 py-2 font-medium">锁定</th>
              <th className="px-3 py-2 font-medium">主机兜底</th>
              <th className="px-3 py-2 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {filteredAccounts.map((account) => {
              const draft = drafts[account.id] || normalizeDraft(account);

              return (
                <tr key={account.id} className="border-t border-slate-200 align-top">
                  <td className="px-3 py-3">
                    <p className="font-medium text-slate-900">{account.nickname}</p>
                    <p className="mt-1 text-xs text-slate-500">{account.groupName || "未分组"} / {account.status}</p>
                  </td>
                  <td className="px-3 py-3">
                    <select
                      value={draft.proxyNodeId}
                      onChange={(event) => updateDraft(account.id, (current) => ({ ...current, proxyNodeId: event.target.value }))}
                      className="w-full rounded-lg border border-slate-200 px-2 py-2 text-xs"
                    >
                      {nodeOptions.map((option) => (
                        <option key={option.value || "none"} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-3">
                    <select
                      value={draft.backupProxyNodeId}
                      onChange={(event) => updateDraft(account.id, (current) => ({ ...current, backupProxyNodeId: event.target.value }))}
                      className="w-full rounded-lg border border-slate-200 px-2 py-2 text-xs"
                    >
                      {nodeOptions.map((option) => (
                        <option key={`backup-${option.value || "none"}`} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-3">
                    <select
                      value={draft.fallbackProxyNodeId}
                      onChange={(event) => updateDraft(account.id, (current) => ({ ...current, fallbackProxyNodeId: event.target.value }))}
                      className="w-full rounded-lg border border-slate-200 px-2 py-2 text-xs"
                    >
                      {nodeOptions.map((option) => (
                        <option key={`fallback-${option.value || "none"}`} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-3">
                    <select
                      value={draft.proxyBindingMode}
                      onChange={(event) => updateDraft(account.id, (current) => ({ ...current, proxyBindingMode: event.target.value as "AUTO" | "MANUAL" }))}
                      className="w-full rounded-lg border border-slate-200 px-2 py-2 text-xs"
                    >
                      <option value="AUTO">自动</option>
                      <option value="MANUAL">手动</option>
                    </select>
                  </td>
                  <td className="px-3 py-3">
                    <label className="inline-flex items-center gap-2 text-xs text-slate-600">
                      <input
                        type="checkbox"
                        checked={draft.proxyBindingLocked}
                        onChange={(event) => updateDraft(account.id, (current) => ({ ...current, proxyBindingLocked: event.target.checked }))}
                      />
                      锁定
                    </label>
                  </td>
                  <td className="px-3 py-3">
                    <label className="inline-flex items-center gap-2 text-xs text-slate-600">
                      <input
                        type="checkbox"
                        checked={draft.allowHostFallback}
                        onChange={(event) => updateDraft(account.id, (current) => ({ ...current, allowHostFallback: event.target.checked }))}
                      />
                      允许
                    </label>
                  </td>
                  <td className="px-3 py-3">
                    <button
                      type="button"
                      onClick={() => handleSave(account.id)}
                      disabled={savingId === account.id}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {savingId === account.id ? "保存中..." : "保存"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
