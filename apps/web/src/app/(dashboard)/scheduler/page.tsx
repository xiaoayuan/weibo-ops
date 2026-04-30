import { SchedulerMonitor } from "@/components/scheduler-monitor";
import { getTaskSchedulerStatus } from "@/lib/app-data";
import { requireSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function SchedulerPage() {
  await requireSession();

  const data = await getTaskSchedulerStatus();

  return <SchedulerMonitor data={data} />;
}
