"use client";

import { NotebookTabs } from "lucide-react";
import { TaskStatusCard } from "@/components/progress-indicators";
import type { Plan } from "@/lib/app-data";

export function DashboardPlanCard({ plans }: { plans: Plan[] }) {
  const total = plans.length;
  const success = plans.filter((p) => p.status === "SUCCESS").length;
  const failed = plans.filter((p) => p.status === "FAILED").length;
  const running = plans.filter((p) => p.status === "RUNNING").length;
  const pending = plans.filter((p) => p.status === "PENDING" || p.status === "READY" || p.status === "QUEUED").length;
  const completed = success + failed;

  return (
    <TaskStatusCard
      title="今日计划概览"
      total={total}
      completed={completed}
      running={running}
      failed={failed}
      pending={pending}
      icon={<NotebookTabs className="h-5 w-5" />}
    />
  );
}
