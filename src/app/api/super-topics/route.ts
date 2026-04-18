import { prisma } from "@/lib/prisma";
import { createSuperTopicSchema } from "@/server/validators/super-topic";

export async function GET() {
  const topics = await prisma.superTopic.findMany({
    orderBy: { createdAt: "desc" },
  });

  return Response.json({ success: true, data: topics });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = createSuperTopicSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json({ success: false, message: "参数校验失败", errors: parsed.error.flatten() }, { status: 400 });
    }

    const topic = await prisma.superTopic.create({
      data: {
        name: parsed.data.name,
        boardName: parsed.data.boardName || null,
        topicUrl: parsed.data.topicUrl || null,
      },
    });

    return Response.json({ success: true, data: topic });
  } catch {
    return Response.json({ success: false, message: "创建超话失败" }, { status: 500 });
  }
}
