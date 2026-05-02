"use client";

import { useState, useMemo } from "react";
import { Trash2 } from "lucide-react";
import { SectionHeader } from "@/components/section-header";
import { SurfaceCard } from "@/components/surface-card";
import { TableShell } from "@/components/table-shell";
import { EmptyState } from "@/components/empty-state";
import type { CommentPoolItem } from "@/lib/app-data";
import { formatDateTime } from "@/lib/date";

type CommentPoolListProps = {
  items: CommentPoolItem[];
  keyword: string;
  onKeywordChange: (keyword: string) => void;
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  onDelete: (ids: string[]) => void;
};

export function CommentPoolList({
  items,
  keyword,
  onKeywordChange,
  selectedIds,
  onSelectionChange,
  onDelete,
}: CommentPoolListProps) {
  const [deleting, setDeleting] = useState(false);

  const filteredItems = useMemo(() => {
    const normalized = keyword.trim().toLowerCase();
    if (!normalized) {
      return items;
    }

    return items.filter((item) => {
      return (
        item.sourceUrl.toLowerCase().includes(normalized) ||
        item.commentId.toLowerCase().includes(normalized) ||
        (item.note || "").toLowerCase().includes(normalized)
      );
    });
  }, [items, keyword]);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      onSelectionChange(filteredItems.map((item) => item.id));
    } else {
      onSelectionChange([]);
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    if (checked) {
      onSelectionChange([...selectedIds, id]);
    } else {
      onSelectionChange(selectedIds.filter((selectedId) => selectedId !== id));
    }
  };

  const handleDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`确定要删除选中的 ${selectedIds.length} 条评论吗？`)) return;

    setDeleting(true);
    try {
      await onDelete(selectedIds);
      onSelectionChange([]);
    } finally {
      setDeleting(false);
    }
  };

  const allSelected = filteredItems.length > 0 && selectedIds.length === filteredItems.length;
  const someSelected = selectedIds.length > 0 && selectedIds.length < filteredItems.length;

  return (
    <SurfaceCard>
      <SectionHeader
        title="评论池"
        description={`共 ${items.length} 条评论${keyword ? `，筛选后 ${filteredItems.length} 条` : ""}`}
        action={
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={keyword}
              onChange={(e) => onKeywordChange(e.target.value)}
              placeholder="搜索评论..."
              className="app-input w-64"
            />
            {selectedIds.length > 0 && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="app-button app-button-danger"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                删除选中 ({selectedIds.length})
              </button>
            )}
          </div>
        }
      />

      {filteredItems.length === 0 ? (
        <div className="mt-5">
          <EmptyState
            title={keyword ? "未找到匹配的评论" : "评论池为空"}
            description={keyword ? "尝试使用其他关键词搜索" : "添加评论到池中以便后续使用"}
          />
        </div>
      ) : (
        <TableShell className="mt-5">
          <table className="app-table min-w-[1000px]">
            <thead>
              <tr>
                <th className="w-12">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(input) => {
                      if (input) {
                        input.indeterminate = someSelected;
                      }
                    }}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="app-checkbox"
                  />
                </th>
                <th>评论 ID</th>
                <th>来源链接</th>
                <th>备注</th>
                <th>标签</th>
                <th>添加时间</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item) => (
                <tr key={item.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(item.id)}
                      onChange={(e) => handleSelectOne(item.id, e.target.checked)}
                      className="app-checkbox"
                    />
                  </td>
                  <td className="font-mono text-sm">{item.commentId}</td>
                  <td className="max-w-[300px] truncate">
                    <a
                      href={item.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-app-accent hover:underline"
                    >
                      {item.sourceUrl}
                    </a>
                  </td>
                  <td className="max-w-[200px] truncate">{item.note || "-"}</td>
                  <td>
                    {item.tags.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {item.tags.map((tag) => (
                          <span key={tag} className="app-chip">
                            {tag}
                          </span>
                        ))}
                      </div>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="text-sm text-app-text-muted">
                    {item.createdAt ? formatDateTime(item.createdAt) : "-"}
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
