"use client";

import { useState } from "react";
import Image from "next/image";
import { RefreshCw, ShieldCheck } from "lucide-react";
import { SectionHeader } from "@/components/section-header";
import { SurfaceCard } from "@/components/surface-card";
import { TableShell } from "@/components/table-shell";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";
import type { WeiboAccount } from "@/lib/app-data";
import { formatDateTime } from "@/lib/date";
import { getAccountStatusText, getLoginStatusText } from "@/lib/text";

type AccountsListProps = {
  accounts: WeiboAccount[];
  checkingId: string | null;
  bulkChecking: boolean;
  deletingId: string | null;
  onEdit: (account: WeiboAccount) => void;
  onEditSession: (account: WeiboAccount) => void;
  onCheckSession: (id: string) => void;
  onBulkCheck: () => void;
  onStartQrLogin: (id: string) => void;
  onDelete: (id: string) => void;
};

export function AccountsList({
  accounts,
  checkingId,
  bulkChecking,
  deletingId,
  onEdit,
  onEditSession,
  onCheckSession,
  onBulkCheck,
  onStartQrLogin,
  onDelete,
}: AccountsListProps) {
  const getStatusTone = (status: WeiboAccount["status"]) => {
    switch (status) {
      case "ACTIVE":
        return "success";
      case "DISABLED":
        return "neutral";
      case "RISKY":
        return "danger";
      case "EXPIRED":
        return "warning";
      default:
        return "neutral";
    }
  };

  const getLoginStatusTone = (status: WeiboAccount["loginStatus"]) => {
    switch (status) {
      case "ONLINE":
        return "success";
      case "EXPIRED":
        return "warning";
      case "FAILED":
        return "danger";
      case "UNKNOWN":
      default:
        return "neutral";
    }
  };

  return (
    <SurfaceCard>
      <SectionHeader
        title="账号列表"
        description={`共 ${accounts.length} 个账号`}
        action={
          <button
            type="button"
            onClick={onBulkCheck}
            disabled={bulkChecking}
            className="app-button app-button-secondary"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${bulkChecking ? "animate-spin" : ""}`} />
            批量检查登录状态
          </button>
        }
      />

      {accounts.length === 0 ? (
        <div className="mt-5">
          <EmptyState title="暂无账号" description="添加账号后将显示在这里" />
        </div>
      ) : (
        <TableShell className="mt-5">
          <table className="app-table min-w-[1400px]">
            <thead>
              <tr>
                <th>昵称</th>
                <th>状态</th>
                <th>登录状态</th>
                <th>代理</th>
                <th>分组</th>
                <th>Cookie 更新时间</th>
                <th>最后检查</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((account) => (
                <tr key={account.id}>
                  <td>
                    <div className="flex items-center gap-3">
                      <div>
                        <div className="font-medium text-app-text-strong">
                          {account.nickname}
                        </div>
                        {account.remark && (
                          <div className="text-xs text-app-text-soft">
                            {account.remark}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td>
                    <StatusBadge tone={getStatusTone(account.status)}>
                      {getAccountStatusText(account.status)}
                    </StatusBadge>
                  </td>
                  <td>
                    <StatusBadge tone={getLoginStatusTone(account.loginStatus)}>
                      {getLoginStatusText(account.loginStatus)}
                    </StatusBadge>
                    {account.loginErrorMessage && (
                      <div className="mt-1 text-xs text-app-danger">
                        {account.loginErrorMessage}
                      </div>
                    )}
                  </td>
                  <td>
                    {account.proxyNode ? (
                      <div className="flex items-center gap-1 text-sm">
                        <ShieldCheck className="h-3 w-3 text-app-success" />
                        <span>{account.proxyNode.name}</span>
                      </div>
                    ) : (
                      <span className="text-app-text-soft">未绑定</span>
                    )}
                  </td>
                  <td>
                    {account.groupName ? (
                      <span className="app-chip">{account.groupName}</span>
                    ) : (
                      <span className="text-app-text-soft">-</span>
                    )}
                  </td>
                  <td className="text-sm text-app-text-muted">
                    {account.cookieUpdatedAt
                      ? formatDateTime(account.cookieUpdatedAt)
                      : "-"}
                  </td>
                  <td className="text-sm text-app-text-muted">
                    {account.lastCheckAt ? formatDateTime(account.lastCheckAt) : "-"}
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onEdit(account)}
                        className="app-button-text text-sm"
                      >
                        编辑
                      </button>
                      <button
                        type="button"
                        onClick={() => onEditSession(account)}
                        className="app-button-text text-sm"
                      >
                        会话
                      </button>
                      <button
                        type="button"
                        onClick={() => onCheckSession(account.id)}
                        disabled={checkingId === account.id}
                        className="app-button-text text-sm"
                      >
                        {checkingId === account.id ? "检查中..." : "检查"}
                      </button>
                      <button
                        type="button"
                        onClick={() => onStartQrLogin(account.id)}
                        className="app-button-text text-sm"
                      >
                        扫码
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(account.id)}
                        disabled={deletingId === account.id}
                        className="app-button-text text-sm text-app-danger"
                      >
                        {deletingId === account.id ? "删除中..." : "删除"}
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
  );
}
