import { InteractionsManager } from "@/components/interactions/interactions-manager";
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

export default async function InteractionsPage() {
  const session = await requirePageRole("VIEWER");

  const [accounts, contents, rawTasks] = await Promise.all([
    prisma.weiboAccount.findMany({
      where: {
        status: "ACTIVE",
        ownerUserId: session.id,
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.copywritingTemplate.findMany({
      where: { status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
    }),
    prisma.interactionTask.findMany({
      include: {
        account: {
          select: {
            id: true,
            nickname: true,
            ownerUserId: true,
          },
        },
        target: true,
        content: true,
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const logs = rawTasks.length
    ? await prisma.executionLog.findMany({
        where: {
          account: {
            ownerUserId: session.id,
          },
        },
        orderBy: { executedAt: "desc" },
        take: Math.max(100, rawTasks.length * 5),
      })
    : [];

  const scheduleNoteMap = new Map<string, string>();

  for (const log of logs) {
    const payload = log.requestPayload;

    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      continue;
    }

    const taskId = (payload as Record<string, unknown>).interactionTaskId;

    if (typeof taskId !== "string" || scheduleNoteMap.has(taskId)) {
      continue;
    }

    const note = formatScheduleNote(payload);

    if (note) {
      scheduleNoteMap.set(taskId, note);
    }
  }

  const tasks = rawTasks.map((task: typeof rawTasks[number]) => ({
    ...task,
    scheduleNote: scheduleNoteMap.get(task.id) || null,
    isOwned: task.account.ownerUserId === session.id,
    account: {
      id: task.account.id,
      nickname: task.account.ownerUserId === session.id ? task.account.nickname : "其他用户账号",
    },
  }));

  return <InteractionsManager accounts={accounts} contents={contents} currentUserId={session.id} currentUserRole={session.role} initialTasks={tasks} />;
}
