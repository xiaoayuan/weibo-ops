import { TrafficPanel } from "@/components/traffic-panel";
import { getTrafficSummary } from "@/lib/app-data";

export const dynamic = "force-dynamic";

export default async function TrafficPage() {
  const data = await getTrafficSummary();

  return <TrafficPanel data={data} />;
}
