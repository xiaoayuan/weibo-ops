"use client";

import { FormEvent, useState } from "react";

type ProxyProtocol = "HTTP" | "HTTPS" | "SOCKS5";

type ProxyNodeItem = {
  id: string;
  name: string;
  protocol: ProxyProtocol;
  host: string;
  port: number;
  username: string | null;
  enabled: boolean;
  maxAccounts: number;
  assignedAccounts: number;
  hasPassword: boolean;
};

type FormState = {
  name: string;
  protocol: ProxyProtocol;
  host: string;
  port: string;
  username: string;
  password: string;
  enabled: boolean;
  maxAccounts: string;
};

const initialForm: FormState = {
  name: "",
  protocol: "HTTP",
  host: "",
  port: "",
  username: "",
  password: "",
  enabled: true,
  maxAccounts: "100",
};

export function ProxyPoolForm({ initialNodes }: { initialNodes: ProxyNodeItem[] }) {
  const [nodes, setNodes] = useState(initialNodes);
  const [form, setForm] = useState<FormState>(initialForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [testingNodeId, setTestingNodeId] = useState<string | null>(null);
  const [nodeTestResults, setNodeTestResults] = useState<Record<string, { success: boolean; message: string; ip?: string }>>({});
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function refreshNodes() {
    const response = await fetch("/api/proxy-nodes", { cache: "no-store" });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || "拉取代理节点失败");
    }

    setNodes(result.data);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setSubmitting(true);
      setError(null);
      setNotice(null);

      const payload = {
        name: form.name.trim(),
        protocol: form.protocol,
        host: form.host.trim(),
        port: Number(form.port),
        username: form.username.trim(),
        password: editingId ? (form.password === "" ? undefined : form.password) : form.password,
        enabled: form.enabled,
        maxAccounts: Number(form.maxAccounts || 100),
      };

      const response = await fetch(editingId ? `/api/proxy-nodes/${editingId}` : "/api/proxy-nodes", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "保存代理节点失败");
      }

      setNotice(editingId ? "代理节点已更新" : "代理节点已创建");
      setForm(initialForm);
      setEditingId(null);
      await refreshNodes();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存代理节点失败");
    } finally {
      setSubmitting(false);
    }
  }

  function startEdit(node: ProxyNodeItem) {
    setEditingId(node.id);
    setForm({
      name: node.name,
      protocol: node.protocol,
      host: node.host,
      port: String(node.port),
      username: node.username || "",
      password: "",
      enabled: node.enabled,
      maxAccounts: String(node.maxAccounts),
    });
    setError(null);
    setNotice(null);
  }

  async function handleDelete(node: ProxyNodeItem) {
    if (!window.confirm(`确认删除代理 ${node.name} 吗？系统会自动迁移已绑定账号。`)) {
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      setNotice(null);

      const response = await fetch(`/api/proxy-nodes/${node.id}`, { method: "DELETE" });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "删除代理失败");
      }

      setNotice("代理节点已删除");
      await refreshNodes();
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除代理失败");
    } finally {
      setSubmitting(false);
    }
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(initialForm);
    setError(null);
  }

  async function handleAutoAssign() {
    try {
      setSubmitting(true);
      setError(null);
      setNotice(null);

      const response = await fetch("/api/proxy-nodes/auto-assign", { method: "POST" });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "自动分配失败");
      }

      setNotice(result.message || "自动分配完成");
      await refreshNodes();
    } catch (err) {
      setError(err instanceof Error ? err.message : "自动分配失败");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleTestNode(node: ProxyNodeItem) {
    try {
      setTestingNodeId(node.id);
      setError(null);
      setNotice(null);

      const response = await fetch(`/api/proxy-nodes/${node.id}/test`, { method: "POST" });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "代理测试失败");
      }

      setNodeTestResults((current) => ({
        ...current,
        [node.id]: {
          success: true,
          message: result.message || "代理连通性测试通过",
          ip: result.data?.ip,
        },
      }));
      setNotice(`${node.name} 测试通过${result.data?.ip ? `，出口IP: ${result.data.ip}` : ""}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "代理测试失败";

      setNodeTestResults((current) => ({
        ...current,
        [node.id]: {
          success: false,
          message,
        },
      }));
      setError(message);
    } finally {
      setTestingNodeId(null);
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4">
        <h3 className="text-lg font-medium">代理池管理</h3>
        <p className="mt-1 text-sm text-slate-500">系统会在创建账号时自动按负载分配代理，并限制单IP最多 100 账号。</p>
        <button
          type="button"
          onClick={handleAutoAssign}
          disabled={submitting}
          className="mt-3 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          为未绑定账号自动分配代理
        </button>
      </div>

      <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-slate-700">代理名称</span>
          <input
            type="text"
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-slate-400"
            placeholder="东京01"
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-medium text-slate-700">协议</span>
          <select
            value={form.protocol}
            onChange={(event) => setForm((current) => ({ ...current, protocol: event.target.value as ProxyProtocol }))}
            className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-slate-400"
          >
            <option value="HTTP">HTTP</option>
            <option value="HTTPS">HTTPS</option>
            <option value="SOCKS5">SOCKS5</option>
          </select>
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-medium text-slate-700">代理主机</span>
          <input
            type="text"
            value={form.host}
            onChange={(event) => setForm((current) => ({ ...current, host: event.target.value }))}
            className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-slate-400"
            placeholder="109.123.229.197"
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-medium text-slate-700">代理端口</span>
          <input
            type="number"
            value={form.port}
            onChange={(event) => setForm((current) => ({ ...current, port: event.target.value }))}
            className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-slate-400"
            placeholder="10179"
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-medium text-slate-700">用户名</span>
          <input
            type="text"
            value={form.username}
            onChange={(event) => setForm((current) => ({ ...current, username: event.target.value }))}
            className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-slate-400"
            placeholder="可选"
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-medium text-slate-700">密码</span>
          <input
            type="password"
            value={form.password}
            onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
            className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-slate-400"
            placeholder={editingId ? "留空则保持不变" : "可选"}
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-medium text-slate-700">单IP账号上限</span>
          <input
            type="number"
            min={1}
            max={100}
            value={form.maxAccounts}
            onChange={(event) => setForm((current) => ({ ...current, maxAccounts: event.target.value }))}
            className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-slate-400"
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-medium text-slate-700">启用状态</span>
          <select
            value={form.enabled ? "ENABLED" : "DISABLED"}
            onChange={(event) => setForm((current) => ({ ...current, enabled: event.target.value === "ENABLED" }))}
            className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-slate-400"
          >
            <option value="ENABLED">启用</option>
            <option value="DISABLED">停用</option>
          </select>
        </label>

        {error ? <p className="md:col-span-2 text-sm text-rose-600">{error}</p> : null}
        {notice ? <p className="md:col-span-2 text-sm text-emerald-600">{notice}</p> : null}

        <div className="md:col-span-2 flex items-center gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "保存中..." : editingId ? "更新代理" : "新增代理"}
          </button>
          {editingId ? (
            <button
              type="button"
              onClick={cancelEdit}
              className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              取消编辑
            </button>
          ) : null}
        </div>
      </form>

      <div className="mt-6 space-y-3">
        {nodes.length === 0 ? (
          <div className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-500">暂无代理节点，请先新增。</div>
        ) : (
          nodes.map((node) => (
            <div key={node.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-slate-900">{node.name}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {node.protocol}://{node.host}:{node.port}
                    {node.username ? ` (${node.username})` : ""}
                  </p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${node.enabled ? "bg-emerald-50 text-emerald-700" : "bg-slate-200 text-slate-700"}`}>
                  {node.enabled ? "启用中" : "已停用"}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-600">
                <span>账号占用：{node.assignedAccounts} / {node.maxAccounts}</span>
                <span>密码：{node.hasPassword ? "已配置" : "未配置"}</span>
              </div>
              <div className="mt-4 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => handleTestNode(node)}
                  disabled={testingNodeId === node.id || submitting}
                  className="rounded-lg border border-sky-200 bg-white px-3 py-2 text-xs font-medium text-sky-700 transition hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {testingNodeId === node.id ? "测试中..." : "测试连通"}
                </button>
                <button
                  type="button"
                  onClick={() => startEdit(node)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
                >
                  编辑
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(node)}
                  className="rounded-lg border border-rose-200 bg-white px-3 py-2 text-xs font-medium text-rose-600 transition hover:bg-rose-50"
                >
                  删除
                </button>
              </div>
              {nodeTestResults[node.id] ? (
                <p className={`mt-3 text-xs ${nodeTestResults[node.id].success ? "text-emerald-700" : "text-rose-600"}`}>
                  {nodeTestResults[node.id].message}
                  {nodeTestResults[node.id].ip ? `（出口IP: ${nodeTestResults[node.id].ip}）` : ""}
                </p>
              ) : null}
            </div>
          ))
        )}
      </div>
    </section>
  );
}
