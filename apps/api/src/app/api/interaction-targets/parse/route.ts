import { requireApiRole } from "@/src/lib/permissions";
import { prisma } from "@/src/lib/prisma";
import { parseInteractionTargetSchema } from "@/src/lib/validators";

export async function POST(request: Request) {
  const auth = await requireApiRole("OPERATOR");

  if (!auth.ok) {
    return auth.response;
  }

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
