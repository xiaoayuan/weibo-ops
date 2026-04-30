import { prisma } from "@/lib/prisma";
import { requireApiRole } from "@/lib/permissions";
import { createTopicTaskSchema } from "@/server/validators/topic-task";

export async function GET() {
  const auth = await requireApiRole("VIEWER");

  if (!auth.ok) {
    return auth.response;
  }

  const tasks = await prisma.accountTopicTask.findMany({
    where: {
      account: {
        ownerUserId: auth.session.id,
      },
    },
    include: {
      account: {
        select: {
          id: true,
          nickname: true,
          status: true,
          loginStatus: true,
          ownerUserId: true,
        },
      },
      superTopic: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return Response.json({ success: true, data: tasks });
}

export async function POST(request: Request) {
  const auth = await requireApiRole("OPERATOR");

  if (!auth.ok) {
    return auth.response;
  }

  try {
    const body = await request.json();
    const parsed = createTopicTaskSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json({ success: false, message: "参数校验失败", errors: parsed.error.flatten() }, { status: 400 });
    }

    const availableAccounts = await prisma.weiboAccount.findMany({
      where: {
        id: {
          in: parsed.data.accountIds,
        },
        ownerUserId: auth.session.id,
      },
      select: {
        id: true,
      },
    });

    if (availableAccounts.length !== parsed.data.accountIds.length) {
      return Response.json({ success: false, message: "包含无权限账号" }, { status: 403 });
    }

    const existed = await prisma.accountTopicTask.findMany({
      where: {
        superTopicId: parsed.data.superTopicId,
        accountId: {
          in: parsed.data.accountIds,
        },
      },
      select: {
        accountId: true,
      },
    });

    const existedIds = new Set(existed.map((item) => item.accountId));
    const createAccountIds = parsed.data.accountIds.filter((id) => !existedIds.has(id));

    if (createAccountIds.length > 0) {
      await prisma.accountTopicTask.createMany({
        data: createAccountIds.map((accountId) => ({
          accountId,
          superTopicId: parsed.data.superTopicId,
          signEnabled: parsed.data.signEnabled,
          firstCommentEnabled: parsed.data.firstCommentEnabled,
          firstCommentPerDay: parsed.data.firstCommentPerDay,
          firstCommentIntervalSec: parsed.data.firstCommentIntervalSec,
          likePerDay: parsed.data.likePerDay,
          likeIntervalSec: parsed.data.likeIntervalSec,
          repostPerDay: parsed.data.repostPerDay,
          repostIntervalSec: parsed.data.repostIntervalSec,
          commentPerDay: parsed.data.commentPerDay,
          commentIntervalSec: parsed.data.commentIntervalSec,
          firstCommentTemplates: [],
          postEnabled: parsed.data.postEnabled,
          minPostsPerDay: parsed.data.minPostsPerDay,
          maxPostsPerDay: parsed.data.maxPostsPerDay,
          startTime: parsed.data.startTime || null,
          endTime: parsed.data.endTime || null,
          status: parsed.data.status,
        })),
      });
    }

    const tasks = await prisma.accountTopicTask.findMany({
      where: {
        superTopicId: parsed.data.superTopicId,
        accountId: {
          in: createAccountIds,
        },
      },
      include: {
        account: {
        select: {
          id: true,
          nickname: true,
          status: true,
          loginStatus: true,
          ownerUserId: true,
        },
      },
        superTopic: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return Response.json({
      success: true,
      data: tasks,
      message:
        existedIds.size > 0
          ? `已新增 ${tasks.length} 条，跳过 ${existedIds.size} 条重复配置`
          : `已新增 ${tasks.length} 条任务配置`,
    });
  } catch {
    return Response.json({ success: false, message: "创建任务失败" }, { status: 500 });
  }
}
