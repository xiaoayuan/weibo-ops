import { PlansManager } from "@/components/plans/plans-manager";
import { formatBusinessDateTime, getBusinessDateText, toBusinessDate } from "@/lib/business-date";
import { requirePageRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

function toBusinessHm(date: Date) {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

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

function getPendingReason(input: {
  planDateText: string;
  todayText: string;
  now: Date;
  status: string;
  scheduledTime: Date;
  autoExecuteEnabled: boolean;
  autoExecuteStartTime: string;
  autoExecuteEndTime: string;
  scheduleNote?: string | null;
}) {
  if (input.status !== "PENDING" && input.status !== "READY") {
    return null;
  }

  if (input.scheduleNote) {
    return input.scheduleNote;
  }

  if (input.planDateText > input.todayText) {
    return "计划日期未到";
  }

  if (!input.autoExecuteEnabled) {
    return "当前用户未开启自动执行";
  }

  const nowHm = toBusinessHm(input.now);
  if (input.planDateText === input.todayText && nowHm < input.autoExecuteStartTime) {
    return `未到自动执行开始时间（${input.autoExecuteStartTime}）`;
  }

  if (input.planDateText === input.todayText && nowHm > input.autoExecuteEndTime) {
    return `已过自动执行结束时间（${input.autoExecuteEndTime}）`;
  }

  if (input.scheduledTime.getTime() > input.now.getTime()) {
    return `尚未到计划时间（${formatBusinessDateTime(input.scheduledTime)})`;
  }

  if (input.status === "READY") {
    return "已确认，等待调度执行";
  }

  return "待自动调度执行";
}

export const dynamic = "force-dynamic";

export default async function PlansPage() {
  const session = await requirePageRole("VIEWER");
  const now = new Date();
  const todayText = getBusinessDateText();
  const planDate = toBusinessDate(todayText);
  const [plans, user] = await Promise.all([
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
    prisma.user.findUnique({
      where: { id: session.id },
      select: {
        autoExecuteEnabled: true,
        autoExecuteStartTime: true,
        autoExecuteEndTime: true,
      },
    }),
  ]);
  const [contents, logs] = await Promise.all([
    prisma.copywritingTemplate.findMany({
      where: { status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
    }),
    plans.length > 0
      ? prisma.executionLog.findMany({
          where: {
            planId: { in: plans.map((plan: typeof plans[number]) => plan.id) },
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

  const plansWithSchedule = plans.map((plan: typeof plans[number]) => {
    const scheduleNote = scheduleNoteMap.get(plan.id) || null;
    return {
      ...plan,
      scheduleNote,
      pendingReason: getPendingReason({
        planDateText: getBusinessDateText(plan.planDate),
        todayText,
        now,
        status: plan.status,
        scheduledTime: plan.scheduledTime,
        autoExecuteEnabled: user?.autoExecuteEnabled ?? true,
        autoExecuteStartTime: user?.autoExecuteStartTime || "09:00",
        autoExecuteEndTime: user?.autoExecuteEndTime || "18:00",
        scheduleNote,
      }),
    };
  });

  return <PlansManager currentUserRole={session.role} initialPlans={plansWithSchedule} initialDate={todayText} contents={contents} />;
}
