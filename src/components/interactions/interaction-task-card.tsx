import type { CopywritingTemplate, InteractionTarget, InteractionTask } from "@/generated/prisma/client";

import { InteractionResultPreview } from "@/components/interactions/interaction-result-preview";

type InteractionStatus = "PENDING" | "READY" | "RUNNING" | "SUCCESS" | "FAILED" | "CANCELLED";

type InteractionTaskWithRelations = InteractionTask & {
  account: {
    id: string;
    nickname: string;
  };
  target: InteractionTarget;
  content: CopywritingTemplate | null;
  isOwned: boolean;
};

const statusText: Record<InteractionStatus, string> = {
  PENDING: "待审核",
  READY: "已确认",
  RUNNING: "执行中",
  SUCCESS: "成功",
  FAILED: "失败",
  CANCELLED: "已取消",
};

export function InteractionTaskCard({
  task,
  canExecute,
  canManage,
  selected,
  onToggle,
  onExecute,
  onStop,
  onDelete,
}: {
  task: InteractionTaskWithRelations;
  canExecute: boolean;
  canManage: boolean;
  selected: boolean;
  onToggle: () => void;
  onExecute: () => void;
  onStop: () => void;
  onDelete: () => void;
}) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:hidden">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="break-all text-sm text-sky-700">{task.target.targetUrl}</p>
          <div className="mt-2 space-y-1 text-sm text-slate-600">
            <p>账号：{task.account.nickname}</p>
            <p>动作：{task.actionType}</p>
            <p>状态：{statusText[task.status]}</p>
            <p>文案：{task.content?.title || "-"}</p>
            <p>创建时间：{new Date(task.createdAt).toLocaleString("zh-CN")}</p>
          </div>
        </div>
        {canExecute ? <input type="checkbox" checked={selected} onChange={onToggle} /> : null}
      </div>

      <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm">
        <p className="mb-1 text-xs font-medium text-slate-500">执行结果</p>
        <InteractionResultPreview result={task.resultMessage} />
      </div>

      <div className="mt-4 flex flex-wrap gap-3 text-sm">
        {canExecute ? (
          <button type="button" onClick={onExecute} className="text-violet-600 transition hover:text-violet-700">
            执行
          </button>
        ) : null}
        {canExecute && ["PENDING", "READY", "RUNNING"].includes(task.status) ? (
          <button type="button" onClick={onStop} className="text-amber-700 transition hover:text-amber-800">
            停止
          </button>
        ) : null}
        {canManage ? (
          <button type="button" onClick={onDelete} className="text-rose-700 transition hover:text-rose-800">
            删除
          </button>
        ) : null}
      </div>
    </article>
  );
}
