import { prisma } from "@/lib/prisma";
import { parseInteractionTargetSchema } from "@/server/validators/interaction";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = parseInteractionTargetSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json({ success: false, message: "参数校验失败", errors: parsed.error.flatten() }, { status: 400 });
    }

    const target = await prisma.interactionTarget.create({
      data: {
        targetUrl: parsed.data.targetUrl,
        targetType: "COMMENT_LINK",
        parsedTargetId: parsed.data.targetUrl.split("/").filter(Boolean).pop() || null,
        status: "PARSED",
      },
    });

    return Response.json({ success: true, data: target });
  } catch {
    return Response.json({ success: false, message: "解析互动目标失败" }, { status: 500 });
  }
}
