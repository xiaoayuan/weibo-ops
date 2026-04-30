import { SuperTopicsManager } from "@/components/super-topics-manager";
import { getSuperTopics } from "@/lib/app-data";
import { requireSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function SuperTopicsPage() {
  await requireSession();

  const topics = await getSuperTopics();

  return <SuperTopicsManager initialTopics={topics} />;
}
