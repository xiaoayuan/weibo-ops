import { KeyRound, ShieldCheck, UserRound } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import { SurfaceCard } from "@/components/surface-card";
import { getAccounts } from "@/lib/app-data";
import { formatDateTime } from "@/lib/date";
import { getAccountStatusText, getLoginStatusText } from "@/lib/text";

export const dynamic = "force-dynamic";

export default async function AccountsPage() {
  const accounts = await getAccounts();
  const onlineCount = accounts.filter((account) => account.loginStatus === "ONLINE").length;
  const riskyCount = accounts.filter((account) => account.status === "RISKY" || account.loginStatus === "FAILED").length;
  const proxyBoundCount = accounts.filter((account) => Boolean(account.proxyNodeId)).length;

  return (
    <div className="space-y-6 lg:space-y-8">
      <PageHeader
        eyebrow="核心管理页"
        title="账号状态先接入新前端"
        description="这一页已经直接读取现有后端账号接口，优先把账号健康、登录态和代理绑定这些高频信息统一到新的表格语义中。"
      />

      <section className="grid gap-4 md:grid-cols-3">
        <StatCard label="账号总数" value={String(accounts.length)} detail="当前用户可见账号" accent="accent" icon={<UserRound className="h-5 w-5" />} />
        <StatCard label="登录在线" value={String(onlineCount)} detail="登录态检测为在线" accent="success" icon={<ShieldCheck className="h-5 w-5" />} />
        <StatCard label="代理绑定" value={String(proxyBoundCount)} detail={`${riskyCount} 个账号需要关注`} accent={riskyCount > 0 ? "warning" : "info"} icon={<KeyRound className="h-5 w-5" />} />
      </section>

      <SurfaceCard>
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-app-text-strong">账号列表</h2>
            <p className="mt-2 text-sm text-app-text-muted">当前先迁移读取视图，后续会继续接入新增、编辑、扫码登录和批量操作。</p>
          </div>
          <button type="button" className="app-button app-button-secondary">
            编辑能力下一步接入
          </button>
        </div>

        {accounts.length === 0 ? (
          <div className="mt-5">
            <EmptyState title="暂时没有账号" description="后端当前没有返回账号数据。等新增流程迁移过来后，这里会成为完整的新账号工作台。" />
          </div>
        ) : (
          <div className="mt-5 overflow-x-auto rounded-[24px] border border-app-line">
            <table className="app-table">
              <thead>
                <tr>
                  <th>账号</th>
                  <th>分组 / UID</th>
                  <th>账号状态</th>
                  <th>登录状态</th>
                  <th>代理</th>
                  <th>最近检查</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((account) => (
                  <tr key={account.id}>
                    <td>
                      <div>
                        <p className="font-medium text-app-text-strong">{account.nickname}</p>
                        <p className="mt-1 text-xs text-app-text-soft">{account.remark || account.username || "暂无备注"}</p>
                      </div>
                    </td>
                    <td>
                      <p>{account.groupName || "未分组"}</p>
                      <p className="mt-1 font-mono text-xs text-app-text-soft">{account.uid || "-"}</p>
                    </td>
                    <td>
                      <StatusBadge tone={account.status === "ACTIVE" ? "success" : account.status === "RISKY" ? "warning" : account.status === "EXPIRED" ? "danger" : "neutral"}>
                        {getAccountStatusText(account.status)}
                      </StatusBadge>
                    </td>
                    <td>
                      <StatusBadge tone={account.loginStatus === "ONLINE" ? "success" : account.loginStatus === "FAILED" ? "danger" : account.loginStatus === "EXPIRED" ? "warning" : "neutral"}>
                        {getLoginStatusText(account.loginStatus)}
                      </StatusBadge>
                      {account.loginErrorMessage ? <p className="mt-2 max-w-[220px] text-xs leading-5 text-app-text-soft">{account.loginErrorMessage}</p> : null}
                    </td>
                    <td>
                      <StatusBadge tone={account.proxyNodeId ? "accent" : "neutral"}>{account.proxyNodeId ? "已绑定代理" : "未绑定代理"}</StatusBadge>
                    </td>
                    <td className="text-xs text-app-text-soft">{account.lastCheckAt ? formatDateTime(account.lastCheckAt) : "未检测"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SurfaceCard>
    </div>
  );
}
