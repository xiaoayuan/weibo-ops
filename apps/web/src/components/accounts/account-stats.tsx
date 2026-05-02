"use client";

import { StatCard } from "@/components/stat-card";
import type { WeiboAccount } from "@/lib/app-data";

type AccountStatsProps = {
  accounts: WeiboAccount[];
};

export function AccountStats({ accounts }: AccountStatsProps) {
  const onlineCount = accounts.filter(
    (account) => account.loginStatus === "ONLINE"
  ).length;

  const riskyCount = accounts.filter(
    (account) => account.status === "RISKY" || account.loginStatus === "FAILED"
  ).length;

  const proxyBoundCount = accounts.filter((account) =>
    Boolean(account.proxyNodeId)
  ).length;

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <StatCard
        label="总账号数"
        value={accounts.length.toString()}
        detail=""
        accent="accent"
      />
      <StatCard
        label="在线账号"
        value={onlineCount.toString()}
        detail=""
        accent="success"
      />
      <StatCard
        label="风险账号"
        value={riskyCount.toString()}
        detail=""
        accent={riskyCount > 0 ? "danger" : undefined}
      />
      <StatCard
        label="已绑定代理"
        value={proxyBoundCount.toString()}
        detail=""
        accent="info"
      />
    </div>
  );
}
