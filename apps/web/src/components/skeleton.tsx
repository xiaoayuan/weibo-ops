"use client";

type TableSkeletonProps = {
  rows?: number;
  columns?: number;
};

export function TableSkeleton({ rows = 5, columns = 6 }: TableSkeletonProps) {
  return (
    <div className="animate-pulse space-y-3">
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex gap-4">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <div
              key={colIndex}
              className="h-12 flex-1 rounded-lg bg-app-panel-muted"
              style={{
                width: colIndex === 0 ? "20%" : colIndex === columns - 1 ? "15%" : "auto",
              }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

type CardSkeletonProps = {
  count?: number;
};

export function CardSkeleton({ count = 3 }: CardSkeletonProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="animate-pulse space-y-3 rounded-2xl border border-app-line bg-app-panel p-6">
          <div className="h-6 w-1/2 rounded bg-app-panel-muted" />
          <div className="h-4 w-3/4 rounded bg-app-panel-muted" />
          <div className="h-4 w-full rounded bg-app-panel-muted" />
        </div>
      ))}
    </div>
  );
}

type ListSkeletonProps = {
  count?: number;
};

export function ListSkeleton({ count = 5 }: ListSkeletonProps) {
  return (
    <div className="animate-pulse space-y-3">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="flex items-center gap-4 rounded-xl border border-app-line bg-app-panel p-4">
          <div className="h-12 w-12 rounded-full bg-app-panel-muted" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-1/3 rounded bg-app-panel-muted" />
            <div className="h-3 w-1/2 rounded bg-app-panel-muted" />
          </div>
          <div className="h-8 w-20 rounded bg-app-panel-muted" />
        </div>
      ))}
    </div>
  );
}

type FormSkeletonProps = {
  fields?: number;
};

export function FormSkeleton({ fields = 4 }: FormSkeletonProps) {
  return (
    <div className="animate-pulse space-y-4">
      {Array.from({ length: fields }).map((_, index) => (
        <div key={index} className="space-y-2">
          <div className="h-4 w-24 rounded bg-app-panel-muted" />
          <div className="h-12 w-full rounded-lg bg-app-panel-muted" />
        </div>
      ))}
      <div className="flex justify-end gap-3 pt-4">
        <div className="h-11 w-24 rounded-lg bg-app-panel-muted" />
        <div className="h-11 w-24 rounded-lg bg-app-panel-muted" />
      </div>
    </div>
  );
}
