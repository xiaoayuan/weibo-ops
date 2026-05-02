"use client";

import { FixedSizeList as List } from "react-window";
import { useRef, useEffect, useState } from "react";

/**
 * 虚拟列表属性
 */
interface VirtualListProps<T> {
  items: T[];
  itemHeight: number;
  height?: number;
  renderItem: (item: T, index: number) => React.ReactNode;
  className?: string;
  emptyText?: string;
}

/**
 * 虚拟列表组件
 * 用于渲染大量数据，提升性能
 */
export function VirtualList<T>({
  items,
  itemHeight,
  height = 600,
  renderItem,
  className = "",
  emptyText = "暂无数据",
}: VirtualListProps<T>) {
  const listRef = useRef<List>(null);
  const [containerHeight, setContainerHeight] = useState(height);

  // 自适应高度
  useEffect(() => {
    const updateHeight = () => {
      const availableHeight = window.innerHeight - 300; // 减去头部和底部空间
      setContainerHeight(Math.min(height, availableHeight));
    };

    updateHeight();
    window.addEventListener("resize", updateHeight);
    return () => window.removeEventListener("resize", updateHeight);
  }, [height]);

  if (items.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-app-text-muted">
        {emptyText}
      </div>
    );
  }

  const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => (
    <div style={style}>{renderItem(items[index], index)}</div>
  );

  return (
    <div className={className}>
      <List
        ref={listRef}
        height={containerHeight}
        itemCount={items.length}
        itemSize={itemHeight}
        width="100%"
      >
        {Row}
      </List>
    </div>
  );
}

/**
 * 虚拟表格行组件
 */
interface VirtualTableRowProps {
  children: React.ReactNode;
  className?: string;
}

export function VirtualTableRow({ children, className = "" }: VirtualTableRowProps) {
  return (
    <div
      className={`flex items-center border-b border-app-line hover:bg-app-panel-muted transition ${className}`}
    >
      {children}
    </div>
  );
}

/**
 * 虚拟表格单元格组件
 */
interface VirtualTableCellProps {
  children: React.ReactNode;
  width?: string;
  className?: string;
}

export function VirtualTableCell({
  children,
  width = "flex-1",
  className = "",
}: VirtualTableCellProps) {
  return (
    <div className={`px-4 py-3 ${width} ${className}`}>
      {children}
    </div>
  );
}
