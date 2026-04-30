import { TrafficPanel } from "@/components/traffic-panel";
import { getTrafficSummary } from "@/lib/app-data";
import { requireSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function TrafficPage() {
  await requireSession();

  const data = await getTrafficSummary();

  return <TrafficPanel data={data} />;
}
