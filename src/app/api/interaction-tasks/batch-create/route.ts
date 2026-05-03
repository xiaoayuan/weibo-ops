import { prisma } from "@/lib/prisma";
import { requireApiRole } from "@/lib/permissions";
import { writeExecutionLog } from "@/server/logs";
import { createInteractionBatchSchema } from "@/server/validators/interaction";

function pickRandom<T>(items: T[]) {
  return items[Math.floor(Math.random() * items.length)];
}

export async function POST(request: Request) {
  const auth = await requireApiRole("OPERATOR");

  if (!auth.ok) {
    return auth.response;
  }

  try {
    const body = await request.json();
    const parsed = createInteractionBatchSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json({ success: false, message: "参数校验失败", errors: parsed.error.flatten() }, { status: 400 });
    }

    const availableAccounts = await prisma.weiboAccount.findMany({
      where: {
        id: { in: parsed.data.accountIds },
        ownerUserId: auth.session.id,
      },
      select: { id: true },
    });

    if (availableAccounts.length !== parsed.data.accountIds.length) {
      return Response.json({ success: false, message: "包含无权限账号" }, { status: 403 });
    }

    const targetUrls = parsed.data.actionType === "COMMENT"
      ? parsed.data.targetUrls || []
      : [parsed.data.targetUrl || ""];
    const normalizedTargetUrls = Array.from(new Set(targetUrls.map((item) => item.trim()).filter(Boolean)));

    const contents = parsed.data.actionType === "COMMENT"
      ? await prisma.copywritingTemplate.findMany({
          where: { id: { in: parsed.data.contentIds || [] }, status: "ACTIVE" },
          select: { id: true },
        })
      : [];

    if (parsed.data.actionType === "COMMENT" && contents.length !== (parsed.data.contentIds || []).length) {
      return Response.json({ success: false, message: "包含不可用文案" }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const createdTaskIds: string[] = [];
      let skippedDuplicateCount = 0;
      let skippedTargetCount = 0;

      for (const targetUrl of normalizedTargetUrls) {
        let targetId: string | null = null;
        let createdForCurrentTarget = 0;

        for (const accountId of parsed.data.accountIds) {
          if (parsed.data.actionType === "COMMENT") {
            const existingTask = await tx.interactionTask.findFirst({
              where: {
                accountId,
                actionType: "COMMENT",
                status: { in: ["PENDING", "READY", "RUNNING"] },
                target: { targetUrl },
              },
              select: { id: true },
            });

            if (existingTask) {
              skippedDuplicateCount += 1;
              continue;
            }
          }

          if (!targetId) {
            const target = await tx.interactionTarget.create({
              data: {
                targetUrl,
                targetType: parsed.data.actionType === "COMMENT" ? "STATUS_LINK" : "COMMENT_LINK",
                parsedTargetId: targetUrl.split("/").filter(Boolean).pop() || null,
                status: "PENDING",
              },
            });
            targetId = target.id;
          }

          const task = await tx.interactionTask.create({
            data: {
              targetId,
              accountId,
              contentId: parsed.data.actionType === "COMMENT" ? pickRandom(contents)?.id || null : null,
              actionType: parsed.data.actionType,
              status: "PENDING",
            },
            select: { id: true },
          });
          createdTaskIds.push(task.id);
          createdForCurrentTarget += 1;
        }

        if (createdForCurrentTarget === 0) {
          skippedTargetCount += 1;
        }
      }

      // Batch-write execution logs outside the transaction to avoid holding locks
      // on ExecutionLog table while the main transaction holds InteractionTask locks
      return { createdTaskIds, skippedDuplicateCount, skippedTargetCount };
    });

    // Write execution logs after transaction commits (non-critical, won't be rolled back)
    for (let i = 0; i < result.createdTaskIds.length; i++) {
      const taskId = result.createdTaskIds[i];
      const task = await prisma.interactionTask.findUnique({
        where: { id: taskId },
        include: { target: { select: { targetUrl: true } }, account: { select: { id: true } } },
      });
      if (task) {
        await writeExecutionLog({
          accountId: task.accountId,
          actionType: "INTERACTION_TASK_CREATED",
          requestPayload: {
            targetUrl: task.target.targetUrl,
            actionType: parsed.data.actionType,
            contentIds: parsed.data.actionType === "COMMENT" ? parsed.data.contentIds || [] : undefined,
          },
          success: true,
        }).catch(() => { /* non-critical */ });
      }
    }

    const tasks = await prisma.interactionTask.findMany({
      where: { id: { in: result.createdTaskIds } },
      include: {
        account: { select: { id: true, nickname: true, status: true, loginStatus: true, ownerUserId: true } },
        target: true,
        content: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return Response.json({
      success: true,
      data: tasks,
      meta: {
        createdCount: result.createdTaskIds.length,
        skippedDuplicateCount: result.skippedDuplicateCount,
        skippedTargetCount: result.skippedTargetCount,
      },
      message:
        result.createdTaskIds.length > 0
          ? `已创建 ${result.createdTaskIds.length} 条互动任务${result.skippedDuplicateCount > 0 ? `，跳过 ${result.skippedDuplicateCount} 条重复任务` : ""}`
          : result.skippedDuplicateCount > 0
            ? `未创建新任务，已跳过 ${result.skippedDuplicateCount} 条重复任务`
            : "未创建新任务",
    });
  } catch (error) {
    console.error("[interaction-tasks/batch-create]", error);
    return Response.json({ success: false, message: "创建互动任务失败" }, { status: 500 });
  }
}