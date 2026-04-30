import { SchedulerMonitor } from "@/components/scheduler-monitor";
import { getTaskSchedulerStatus } from "@/lib/app-data";

export const dynamic = "force-dynamic";

export default async function SchedulerPage() {
  const data = await getTaskSchedulerStatus();

  return <SchedulerMonitor data={data} />;
}
