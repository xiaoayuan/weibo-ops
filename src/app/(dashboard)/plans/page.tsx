import { PlansManager } from "@/components/plans/plans-manager";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function todayText() {
  return new Date().toISOString().slice(0, 10);
}

export default async function PlansPage() {
  const planDate = new Date(`${todayText()}T00:00:00`);
  const [plans, contents] = await Promise.all([
    prisma.dailyPlan.findMany({
      where: { planDate },
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

  return <PlansManager initialPlans={plans} initialDate={todayText()} contents={contents} />;
}
