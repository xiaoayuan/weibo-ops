import { PlansManager } from "@/components/plans-manager";
import { getCopywritingTemplates, getTodayPlans } from "@/lib/app-data";
import { getBusinessDateText } from "@/lib/date";

export const dynamic = "force-dynamic";

export default async function PlansPage() {
  const [plans, contents] = await Promise.all([getTodayPlans(), getCopywritingTemplates()]);

  return <PlansManager initialPlans={plans} initialDate={getBusinessDateText()} contents={contents} />;
}
