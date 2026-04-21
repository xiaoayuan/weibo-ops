import { PlansManager } from "@/components/plans/plans-manager";
import { getBusinessDateText, toBusinessDate } from "@/lib/business-date";
import { requirePageRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function PlansPage() {
  const session = await requirePageRole("VIEWER");
  const todayText = getBusinessDateText();
  const planDate = toBusinessDate(todayText);
  const [plans, contents] = await Promise.all([
    prisma.dailyPlan.findMany({
      where: {
        planDate,
        account: {
          ownerUserId: session.id,
        },
      },
      include: {
        account: true,
        content: true,
        task: {
          include: {
            superTopic: true,
          },
        },
      },
      orderBy: { scheduledTime: "asc" },
    }),
    prisma.copywritingTemplate.findMany({
      where: { status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return <PlansManager currentUserRole={session.role} initialPlans={plans} initialDate={todayText} contents={contents} />;
}
