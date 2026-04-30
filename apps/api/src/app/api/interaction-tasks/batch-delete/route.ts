import { writeExecutionLog } from "@/src/lib/execution-log";
import { requireApiRole } from "@/src/lib/permissions";
import { prisma } from "@/src/lib/prisma";

export async function POST(request: Request) {
  const auth = await requireApiRole("OPERATOR");

  if (!auth.ok) {
    return auth.response;
  }

  try {
    const body = (await request.json()) as { taskIds?: string[] };
    const taskIds = Array.from(new Set((body.taskIds || []).map((item) => item.trim()).filter(Boolean)));

    if (taskIds.length === 0) {
      return Response.json({ success: false, message: "请至少选择一条互动任务" }, { status: 400 });
    }

    const tasks = await prisma.interactionTask.findMany({
      where: {
        id: { in: taskIds },
        account: {
          ownerUserId: auth.session.id,
        },
      },
      select: {
        id: true,
        accountId: true,
      },
    });

    if (tasks.length === 0) {
      return Response.json({ success: false, message: "未找到可删除的互动任务" }, { status: 404 });
    }

    await prisma.interactionTask.deleteMany({
      where: {
        id: {
          in: tasks.map((task) => task.id),
        },
      },
    });

    await Promise.all(
      tasks.map((task) =>
        writeExecutionLog({
          accountId: task.accountId,
          actionType: "INTERACTION_TASK_BATCH_DELETED",
          requestPayload: { id: task.id },
          success: true,
        }),
      ),
    );

    return Response.json({
      success: true,
      data: {
        deletedIds: tasks.map((task) => task.id),
        deletedCount: tasks.length,
        skippedCount: taskIds.length - tasks.length,
      },
      message: `已删除 ${tasks.length} 条互动任务`,
    });
  } catch {
    return Response.json({ success: false, message: "批量删除互动任务失败" }, { status: 500 });
  }
}
