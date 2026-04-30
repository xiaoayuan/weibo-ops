import { SuperTopicsManager } from "@/components/super-topics-manager";
import { getSuperTopics } from "@/lib/app-data";

export const dynamic = "force-dynamic";

export default async function SuperTopicsPage() {
  const topics = await getSuperTopics();

  return <SuperTopicsManager initialTopics={topics} />;
}
