"use client";

import { useMemo, useState } from "react";

import { AppNotice } from "@/components/app-notice";
import type { ProxyBindingAccount, ProxyNode } from "@/lib/app-data";
import { readJsonResponse } from "@/lib/http";
import { getProxyProtocolText, getProxyRotationModeText } from "@/lib/text";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { SectionHeader } from "@/components/section-header";
import { StatusBadge } from "@/components/status-badge";
import { SurfaceCard } from "@/components/surface-card";
import { TableShell } from "@/components/table-shell";

type NodeForm = {
  name: string;
  protocol: "HTTP" | "HTTPS" | "SOCKS5";
  rotationMode: "STICKY" | "M1" | "M5" | "M10";
  countryCode: string;
  host: string;
  port: number;
  username: string;
  password: string;
  enabled: boolean;
  maxAccounts: number;
};

function createNodeForm(): NodeForm {
  return {
    name: "",
    protocol: "HTTP",
    rotationMode: "M5",
    countryCode: "",
    host: "",
    port: 8080,
    username: "",
    password: "",
    enabled: true,
    maxAccounts: 100,
  };
}

type DraftState = {
  proxyNodeId: string;
  backupProxyNodeId: string;
  fallbackProxyNodeId: string;
  proxyBindingMode: "AUTO" | "MANUAL";
  proxyBindingLocked: boolean;
  allowHostFallback: boolean;
};

type ProxyTestResult = {
  success: boolean;
  code?: string;
  message?: string;
  data?: {
    nodeId: string;
    nodeName: string;
    ip?: string;
    ipStatus?: number;
    weiboStatus?: number;
    weiboFinalUrl?: string;
  };
};

function normalizeDraft(account: ProxyBindingAccount): DraftState {
  return {
    proxyNodeId: account.proxyNodeId || "",
    backupProxyNodeId: account.backupProxyNodeId || "",
    fallbackProxyNodeId: account.fallbackProxyNodeId || "",
    proxyBindingMode: account.proxyBindingMode,
    proxyBindingLocked: account.proxyBindingLocked,
    allowHostFallback: account.allowHostFallback,
  };
}

export function ProxyCenterManager({
  initialNodes,
  initialAccounts,
}: {
  initialNodes: ProxyNode[];
  initialAccounts: ProxyBindingAccount[];
}) {
  const [nodes, setNodes] = useState(initialNodes);
  const [accounts, setAccounts] = useState(initialAccounts);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [nodeForm, setNodeForm] = useState<NodeForm>(createNodeForm);
  const [keyword, setKeyword] = useState("");
  const [drafts, setDrafts] = useState<Record<string, DraftState>>(() => Object.fromEntries(initialAccounts.map((account) => [account.id, normalizeDraft(account)])));
  const [submitting, setSubmitting] = useState(false);
  const [testingNodeId, setTestingNodeId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const nodeOptions = useMemo(
    () => [{ value: "", label: "未设置" }, ...nodes.map((node) => ({ value: node.id, label: `${node.name} (${node.countryCode || "--"}) ${node.host}:${node.port}` }))],
    [nodes],
  );

  const filteredAccounts = useMemo(() => {
    const normalized = keyword.trim().toLowerCase();

    if (!normalized) {
      return accounts;
    }

    return accounts.filter((account) => account.nickname.toLowerCase().includes(normalized) || (account.groupName || "").toLowerCase().includes(normalized));
  }, [accounts, keyword]);

  async function reloadBindings() {
    const response = await fetch("/api/proxy-bindings", { cache: "no-store" });
    const result = await readJsonResponse<{ success: boolean; message?: string; data: { nodes: ProxyNode[]; accounts: ProxyBindingAccount[] } }>(response);

    if (!response.ok) {
      throw new Error(result.message || "刷新绑定失败");
    }

    setAccounts(result.data.accounts);
    setDrafts(Object.fromEntries(result.data.accounts.map((account: ProxyBindingAccount) => [account.id, normalizeDraft(account)])));
  }

  async function submitNode() {
    try {
      setSubmitting(true);
      setError(null);
      setNotice(null);

      const response = await fetch(editingNodeId ? `/api/proxy-nodes/${editingNodeId}` : "/api/proxy-nodes", {
        method: editingNodeId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nodeForm),
      });
      const result = await readJsonResponse<{ success: boolean; message?: string; data: ProxyNode }>(response);

      if (!response.ok) {
        throw new Error(result.message || (editingNodeId ? "更新代理失败" : "创建代理失败"));
      }

      setNodes((current) => (editingNodeId ? current.map((item) => (item.id === editingNodeId ? { ...item, ...result.data } : item)) : [result.data, ...current]));
      setNotice(result.message || (editingNodeId ? "代理节点已更新" : "代理节点已创建"));
      setEditingNodeId(null);
      setNodeForm(createNodeForm());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : editingNodeId ? "更新代理失败" : "创建代理失败");
    } finally {
      setSubmitting(false);
    }
  }

  async function removeNode(id: string) {
    if (!window.confirm("确认删除这个代理节点吗？")) {
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      setNotice(null);

      const response = await fetch(`/api/proxy-nodes/${id}`, { method: "DELETE" });
      const result = await readJsonResponse<{ success: boolean; message?: string }>(response);

      if (!response.ok) {
        throw new Error(result.message || "删除代理失败");
      }

      setNodes((current) => current.filter((item) => item.id !== id));
      await reloadBindings();
      setNotice(result.message || "代理节点已删除");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "删除代理失败");
    } finally {
      setSubmitting(false);
    }
  }

  async function saveBinding(accountId: string) {
    try {
      setSubmitting(true);
      setError(null);
      setNotice(null);

      const draft = drafts[accountId];
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
      const result = await readJsonResponse<{ success: boolean; message?: string; data: ProxyBindingAccount }>(response);

      if (!response.ok) {
        throw new Error(result.message || "保存绑定失败");
      }

      setAccounts((current) => current.map((account) => (account.id === accountId ? { ...account, ...result.data } : account)));
      setNotice("账号代理绑定已保存");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "保存绑定失败");
    } finally {
      setSubmitting(false);
    }
  }

  async function autoAssign() {
    try {
      setSubmitting(true);
      setError(null);
      setNotice(null);

      const response = await fetch("/api/proxy-bindings/auto-assign", { method: "POST" });
      const result = await readJsonResponse<{ success: boolean; message?: string; data: { total: number; updated: number } }>(response);

      if (!response.ok) {
        throw new Error(result.message || "自动绑定失败");
      }

      await reloadBindings();
      setNotice(result.message || "自动绑定完成");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "自动绑定失败");
    } finally {
      setSubmitting(false);
    }
  }

  async function testNode(id: string) {
    try {
      setTestingNodeId(id);
      setError(null);
      setNotice(null);

      const response = await fetch(`/api/proxy-nodes/${id}/test`, { method: "POST" });
      const result = await readJsonResponse<ProxyTestResult>(response);

      if (!response.ok) {
        throw new Error(result.message || "代理测试失败");
      }

      const details = result.data?.ip
        ? `出口 ${result.data.ip} / 微博 ${result.data.weiboStatus || "-"}`
        : "连通性测试通过";
      setNotice(`${result.message || "代理测试通过"}，${details}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "代理测试失败");
    } finally {
      setTestingNodeId(null);
    }
  }

  return (
    <div className="space-y-6 lg:space-y-8">
      <PageHeader eyebrow="代理中心" title="代理池管理" description="管理代理节点，配置账号主备代理绑定和自动分配。" />

      <SurfaceCard>
        <SectionHeader title={editingNodeId ? "编辑代理节点" : "新增代理节点"} description="这里可以直接维护代理节点并测试连通性。" />
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <input value={nodeForm.name} onChange={(event) => setNodeForm((current) => ({ ...current, name: event.target.value }))} className="app-input h-12" placeholder="代理名称" />
          <select value={nodeForm.protocol} onChange={(event) => setNodeForm((current) => ({ ...current, protocol: event.target.value as NodeForm["protocol"] }))} className="app-input h-12">
            <option value="HTTP">HTTP</option>
            <option value="HTTPS">HTTPS</option>
            <option value="SOCKS5">SOCKS5</option>
          </select>
          <select value={nodeForm.rotationMode} onChange={(event) => setNodeForm((current) => ({ ...current, rotationMode: event.target.value as NodeForm["rotationMode"] }))} className="app-input h-12">
            <option value="STICKY">粘性</option>
            <option value="M1">1 分钟</option>
            <option value="M5">5 分钟</option>
            <option value="M10">10 分钟</option>
          </select>
          <input value={nodeForm.countryCode} onChange={(event) => setNodeForm((current) => ({ ...current, countryCode: event.target.value }))} className="app-input h-12" placeholder="国家/地区代码" />
          <input value={nodeForm.host} onChange={(event) => setNodeForm((current) => ({ ...current, host: event.target.value }))} className="app-input h-12" placeholder="主机" />
          <input type="number" value={nodeForm.port} onChange={(event) => setNodeForm((current) => ({ ...current, port: Number(event.target.value) || 1 }))} className="app-input h-12" placeholder="端口" />
          <input value={nodeForm.username} onChange={(event) => setNodeForm((current) => ({ ...current, username: event.target.value }))} className="app-input h-12" placeholder="用户名" />
          <input value={nodeForm.password} onChange={(event) => setNodeForm((current) => ({ ...current, password: event.target.value }))} className="app-input h-12" placeholder="密码（留空则不改）" />
          <input type="number" min={1} max={100} value={nodeForm.maxAccounts} onChange={(event) => setNodeForm((current) => ({ ...current, maxAccounts: Number(event.target.value) || 1 }))} className="app-input h-12" placeholder="账号上限" />
          <label className="flex items-center gap-3 rounded-[20px] border border-app-line bg-app-panel-strong/70 px-4 py-3 text-sm text-app-text-soft">
            <input type="checkbox" checked={nodeForm.enabled} onChange={(event) => setNodeForm((current) => ({ ...current, enabled: event.target.checked }))} />
            节点启用
          </label>
        </div>

        {error ? <AppNotice tone="error" className="mt-4">{error}</AppNotice> : null}
        {notice ? <AppNotice tone="success" className="mt-4">{notice}</AppNotice> : null}

        <div className="mt-5 flex flex-wrap justify-end gap-3">
          {editingNodeId ? (
            <button type="button" onClick={() => { setEditingNodeId(null); setNodeForm(createNodeForm()); }} className="app-button app-button-secondary">
              取消编辑
            </button>
          ) : null}
          <button type="button" onClick={() => void submitNode()} disabled={submitting} className="app-button app-button-primary">
            {editingNodeId ? "保存代理节点" : "创建代理节点"}
          </button>
        </div>
      </SurfaceCard>

      <SurfaceCard>
        <SectionHeader title="代理节点列表" description="支持直接编辑、删除和测试单个代理节点。" />
        {nodes.length === 0 ? (
          <div className="mt-5">
            <EmptyState title="暂无代理节点" description="先创建代理节点，再继续维护账号的主代理、备代理和自动分配策略。" />
          </div>
        ) : (
          <TableShell className="mt-5">
            <table className="app-table min-w-[1100px]">
              <thead>
                <tr>
                  <th>节点</th>
                  <th>协议</th>
                  <th>轮换</th>
                  <th>容量</th>
                  <th>状态</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {nodes.map((node) => (
                  <tr key={node.id}>
                    <td>
                      <p className="font-medium text-app-text-strong">{node.name}</p>
                      <p className="mt-1 font-mono text-xs text-app-text-soft">{node.host}:{node.port}</p>
                    </td>
                    <td>{getProxyProtocolText(node.protocol)}</td>
                    <td>{getProxyRotationModeText(node.rotationMode)}</td>
                    <td className="text-xs text-app-text-soft">{node.assignedAccounts} / {node.maxAccounts || 100}</td>
                    <td>
                      <StatusBadge tone={node.enabled ? "success" : "neutral"}>{node.enabled ? "启用" : "停用"}</StatusBadge>
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingNodeId(node.id);
                            setNodeForm({
                              name: node.name,
                              protocol: node.protocol,
                              rotationMode: node.rotationMode,
                              countryCode: node.countryCode || "",
                              host: node.host,
                              port: node.port,
                              username: node.username || "",
                              password: "",
                              enabled: node.enabled,
                              maxAccounts: node.maxAccounts || 100,
                            });
                          }}
                          className="app-button app-button-secondary h-10 px-4 text-xs"
                        >
                          编辑
                        </button>
                        <button type="button" onClick={() => void testNode(node.id)} disabled={testingNodeId === node.id} className="app-button app-button-secondary h-10 px-4 text-xs">
                          {testingNodeId === node.id ? "测试中" : "测试代理"}
                        </button>
                        <button type="button" onClick={() => void removeNode(node.id)} disabled={submitting} className="app-button app-button-secondary h-10 px-4 text-xs text-app-danger hover:border-app-danger/30 hover:text-app-danger">
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

      <SurfaceCard>
        <SectionHeader
          title="账号代理绑定"
          description="维护主备代理绑定、模式切换和主机兜底。"
          action={
            <div className="flex flex-wrap items-center justify-between gap-3">
              <input value={keyword} onChange={(event) => setKeyword(event.target.value)} className="app-input h-12 max-w-sm" placeholder="搜索账号昵称或分组" />
              <button type="button" onClick={() => void autoAssign()} disabled={submitting} className="app-button app-button-secondary">
                自动绑定（仅 AUTO 账号）
              </button>
            </div>
          }
        />

        {filteredAccounts.length === 0 ? (
          <div className="mt-5">
            <EmptyState title="没有可配置的账号" description="当前筛选下没有账号，或者后端还未返回账号绑定数据。" />
          </div>
        ) : (
          <TableShell className="mt-5">
            <table className="app-table min-w-[1380px]">
              <thead>
                <tr>
                  <th>账号</th>
                  <th>主代理</th>
                  <th>备代理 1</th>
                  <th>备代理 2</th>
                  <th>模式</th>
                  <th>锁定</th>
                  <th>主机兜底</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredAccounts.map((account) => {
                  const draft = drafts[account.id] || normalizeDraft(account);

                  return (
                    <tr key={account.id}>
                      <td>
                        <p className="font-medium text-app-text-strong">{account.nickname}</p>
                        <p className="mt-1 text-xs text-app-text-soft">{account.groupName || "未分组"}</p>
                      </td>
                      <td>
                        <select value={draft.proxyNodeId} onChange={(event) => setDrafts((current) => ({ ...current, [account.id]: { ...draft, proxyNodeId: event.target.value } }))} className="app-input h-11 min-w-[220px]">
                          {nodeOptions.map((option) => (
                            <option key={option.value || "none"} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <select value={draft.backupProxyNodeId} onChange={(event) => setDrafts((current) => ({ ...current, [account.id]: { ...draft, backupProxyNodeId: event.target.value } }))} className="app-input h-11 min-w-[220px]">
                          {nodeOptions.map((option) => (
                            <option key={`backup-${option.value || "none"}`} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <select value={draft.fallbackProxyNodeId} onChange={(event) => setDrafts((current) => ({ ...current, [account.id]: { ...draft, fallbackProxyNodeId: event.target.value } }))} className="app-input h-11 min-w-[220px]">
                          {nodeOptions.map((option) => (
                            <option key={`fallback-${option.value || "none"}`} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <select value={draft.proxyBindingMode} onChange={(event) => setDrafts((current) => ({ ...current, [account.id]: { ...draft, proxyBindingMode: event.target.value as DraftState["proxyBindingMode"] } }))} className="app-input h-11 w-[120px]">
                          <option value="AUTO">自动</option>
                          <option value="MANUAL">手动</option>
                        </select>
                      </td>
                      <td>
                        <label className="inline-flex items-center gap-2 text-xs text-app-text-soft">
                          <input type="checkbox" checked={draft.proxyBindingLocked} onChange={(event) => setDrafts((current) => ({ ...current, [account.id]: { ...draft, proxyBindingLocked: event.target.checked } }))} /> 锁定
                        </label>
                      </td>
                      <td>
                        <label className="inline-flex items-center gap-2 text-xs text-app-text-soft">
                          <input type="checkbox" checked={draft.allowHostFallback} onChange={(event) => setDrafts((current) => ({ ...current, [account.id]: { ...draft, allowHostFallback: event.target.checked } }))} /> 允许
                        </label>
                      </td>
                      <td>
                        <button type="button" onClick={() => void saveBinding(account.id)} disabled={submitting} className="app-button app-button-secondary h-10 px-4 text-xs">
                          保存
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableShell>
        )}
      </SurfaceCard>
    </div>
  );
}
