import { prisma } from "@/lib/prisma";
import { requireApiRole } from "@/lib/permissions";
import { createTopicTaskSchema } from "@/server/validators/topic-task";

export async function GET() {
  const tasks = await prisma.accountTopicTask.findMany({
    include: {
      account: true,
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

    const task = await prisma.accountTopicTask.create({
      data: {
        ...parsed.data,
        startTime: parsed.data.startTime || null,
        endTime: parsed.data.endTime || null,
      },
      include: {
        account: true,
        superTopic: true,
      },
    });

    return Response.json({ success: true, data: task });
  } catch {
    return Response.json({ success: false, message: "创建任务失败" }, { status: 500 });
  }
}
