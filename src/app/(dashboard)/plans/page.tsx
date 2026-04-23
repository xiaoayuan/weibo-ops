import { PlansManager } from "@/components/plans/plans-manager";
import { getBusinessDateText, toBusinessDate } from "@/lib/business-date";
import { requirePageRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

function readScheduleDecision(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }

  const decision = (payload as Record<string, unknown>).scheduleDecision;

  if (!decision || typeof decision !== "object" || Array.isArray(decision)) {
    return null;
  }

  return decision as {
    taskType?: string;
    baseTier?: string;
    effectiveTier?: string;
    delayMs?: number;
    reasons?: string[];
  };
}

function formatScheduleNote(payload: unknown) {
  const decision = readScheduleDecision(payload);

  if (!decision) {
    return null;
  }

  const delayMs = Number(decision.delayMs || 0);
  const delayText = delayMs <= 0 ? "未延后" : delayMs < 60_000 ? `${Math.ceil(delayMs / 1000)} 秒` : `${Math.ceil(delayMs / 60_000)} 分钟`;
  const reasons = decision.reasons && decision.reasons.length > 0 ? decision.reasons.join(" / ") : "正常调度";

  return `${decision.baseTier || "-"} -> ${decision.effectiveTier || decision.baseTier || "-"}，${delayText}，${reasons}`;
}

export const dynamic = "force-dynamic";

export default async function PlansPage() {
  const session = await requirePageRole("VIEWER");
  const todayText = getBusinessDateText();
  const planDate = toBusinessDate(todayText);
  const plans = await prisma.dailyPlan.findMany({
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
    });
  const [contents, logs] = await Promise.all([
    prisma.copywritingTemplate.findMany({
      where: { status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
    }),
    plans.length > 0
      ? prisma.executionLog.findMany({
          where: {
            planId: { in: plans.map((plan) => plan.id) },
          },
          orderBy: { executedAt: "desc" },
          take: plans.length * 4,
        })
      : Promise.resolve([]),
  ]);

  const scheduleNoteMap = new Map<string, string>();

  for (const log of logs) {
    if (!log.planId || scheduleNoteMap.has(log.planId)) {
      continue;
    }

    const note = formatScheduleNote(log.requestPayload);

    if (note) {
      scheduleNoteMap.set(log.planId, note);
    }
  }

  const plansWithSchedule = plans.map((plan) => ({
    ...plan,
    scheduleNote: scheduleNoteMap.get(plan.id) || null,
  }));

  return <PlansManager currentUserRole={session.role} initialPlans={plansWithSchedule} initialDate={todayText} contents={contents} />;
}
