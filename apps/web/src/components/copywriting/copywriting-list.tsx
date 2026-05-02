"use client";

import { Pencil, Trash2 } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { SectionHeader } from "@/components/section-header";
import { StatusBadge } from "@/components/status-badge";
import { SurfaceCard } from "@/components/surface-card";
import { TableShell } from "@/components/table-shell";
import type { CopywritingTemplate } from "@/lib/app-data";
import { getCopywritingSourceText } from "./utils";
import type { AiBusinessType } from "./types";
import { AI_BUSINESS_TYPE_TEXT } from "./types";

type CopywritingListProps = {
  items: CopywritingTemplate[];
  sourceFilter: "ALL" | "MANUAL" | "AI";
  businessFilter: "ALL" | AiBusinessType;
  submitting: boolean;
  onSourceFilterChange: (filter: "ALL" | "MANUAL" | "AI") => void;
  onBusinessFilterChange: (filter: "ALL" | AiBusinessType) => void;
  onEdit: (item: CopywritingTemplate) => void;
  onDelete: (id: string) => void;
};

export function CopywritingList({
  items,
  sourceFilter,
  businessFilter,
  submitting,
  onSourceFilterChange,
  onBusinessFilterChange,
  onEdit,
  onDelete,
}: CopywritingListProps) {
  return (
    <SurfaceCard>
      <SectionHeader
        title="文案列表"
        action={
          <div className="flex flex-col gap-3 md:flex-row">
            <select
              value={sourceFilter}
              onChange={(e) => onSourceFilterChange(e.target.value as "ALL" | "MANUAL" | "AI")}
              className="app-input md:w-[180px]"
            >
              <option value="ALL">全部来源</option>
              <option value="MANUAL">手动</option>
              <option value="AI">AI</option>
            </select>
            <select
              value={businessFilter}
              onChange={(e) => onBusinessFilterChange(e.target.value as "ALL" | AiBusinessType)}
              className="app-input md:w-[220px]"
            >
              <option value="ALL">全部业务</option>
              <option value="DAILY_PLAN">每日计划</option>
              <option value="QUICK_REPLY">一键回复</option>
              <option value="COMMENT_CONTROL">控评</option>
              <option value="REPOST_ROTATION">轮转</option>
            </select>
          </div>
        }
      />

      {items.length === 0 ? (
        <div className="mt-5">
          <EmptyState title="暂无文案" description="当前筛选下没有文案。你可以先新增一条，或者切换筛选条件。" />
        </div>
      ) : (
        <TableShell className="mt-5">
          <table className="app-table min-w-[1180px]">
            <thead>
              <tr>
                <th>标题</th>
                <th>内容预览</th>
                <th>标签</th>
                <th>来源</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td className="font-medium text-app-text-strong">{item.title}</td>
                  <td className="max-w-[340px] text-sm leading-7 text-app-text-muted">{item.content}</td>
                  <td>
                    <div className="flex max-w-[220px] flex-wrap gap-2">
                      {item.tags.length > 0 ? (
                        item.tags.map((tag) => (
                          <span key={tag} className="app-chip">
                            {tag}
                          </span>
                        ))
                      ) : (
                        <span className="text-app-text-soft">-</span>
                      )}
                    </div>
                  </td>
                  <td>
                    <span className="app-chip">{getCopywritingSourceText(item)}</span>
                  </td>
                  <td>
                    <StatusBadge tone={item.status === "ACTIVE" ? "success" : "neutral"}>
                      {item.status === "ACTIVE" ? "启用" : "停用"}
                    </StatusBadge>
                  </td>
                  <td>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => onEdit(item)}
                        disabled={submitting}
                        className="app-button app-button-secondary h-10 px-4 text-xs"
                      >
                        <Pencil className="mr-1.5 h-3.5 w-3.5" />
                        编辑
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(item.id)}
                        disabled={submitting}
                        className="app-button app-button-secondary h-10 px-4 text-xs text-app-danger hover:border-app-danger/30 hover:text-app-danger"
                      >
                        <Trash2 className="mr-1.5 h-3.5 w-3.5" />
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
  );
}
