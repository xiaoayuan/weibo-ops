"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

export type PaginationInfo = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

type PaginationProps = {
  pagination: PaginationInfo;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
};

export function Pagination({ pagination, onPageChange, onPageSizeChange }: PaginationProps) {
  const { page, pageSize, total, totalPages } = pagination;

  const startItem = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const endItem = Math.min(page * pageSize, total);

  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 7;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (page <= 4) {
        for (let i = 1; i <= 5; i++) {
          pages.push(i);
        }
        pages.push("...");
        pages.push(totalPages);
      } else if (page >= totalPages - 3) {
        pages.push(1);
        pages.push("...");
        for (let i = totalPages - 4; i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
        pages.push(1);
        pages.push("...");
        for (let i = page - 1; i <= page + 1; i++) {
          pages.push(i);
        }
        pages.push("...");
        pages.push(totalPages);
      }
    }

    return pages;
  };

  if (totalPages <= 1) {
    return null;
  }

  return (
    <div className="flex items-center justify-between border-t border-app-line bg-app-panel px-6 py-4">
      <div className="flex items-center gap-4">
        <div className="text-sm text-app-text-soft">
          显示 {startItem} - {endItem} 条，共 {total} 条
        </div>
        {onPageSizeChange && (
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="app-input w-auto text-sm"
          >
            <option value={20}>20 条/页</option>
            <option value={50}>50 条/页</option>
            <option value={100}>100 条/页</option>
          </select>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          className="app-button app-button-secondary h-9 w-9 p-0 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        {getPageNumbers().map((pageNum, index) =>
          pageNum === "..." ? (
            <span key={`ellipsis-${index}`} className="px-2 text-app-text-soft">
              ...
            </span>
          ) : (
            <button
              key={pageNum}
              type="button"
              onClick={() => onPageChange(pageNum as number)}
              className={`h-9 min-w-[36px] rounded-lg px-3 text-sm font-medium transition-colors ${
                page === pageNum
                  ? "bg-app-accent text-white"
                  : "text-app-text hover:bg-app-panel-muted"
              }`}
            >
              {pageNum}
            </button>
          )
        )}

        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages}
          className="app-button app-button-secondary h-9 w-9 p-0 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
