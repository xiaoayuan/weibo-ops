import { prisma } from "@/lib/prisma";
import { requireApiRole } from "@/lib/permissions";
import { buildAiCopywritingTags } from "@/server/copywriting/ai";
import { saveAiCopywritingSchema } from "@/server/validators/copywriting";

export async function POST(request: Request) {
  const auth = await requireApiRole("OPERATOR");

  if (!auth.ok) {
    return auth.response;
  }

  try {
    const body = await request.json();
    const parsed = saveAiCopywritingSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json({ success: false, message: "参数校验失败", errors: parsed.error.flatten() }, { status: 400 });
    }

    const aiTags = buildAiCopywritingTags(
      {
        businessType: parsed.data.businessType,
        context: "",
        tone: parsed.data.tone,
        count: parsed.data.items.length,
        length: parsed.data.length,
        constraints: parsed.data.constraints,
      },
      parsed.data.batchId,
    );

    const created = await prisma.$transaction(
      parsed.data.items.map((item, index) =>
        prisma.copywritingTemplate.create({
          data: {
            title: item.title,
            content: item.content,
            status: item.status,
            tags: Array.from(
              new Set([
                ...item.tags,
                ...aiTags,
                ...(parsed.data.riskAssessments?.[index]?.riskLevel ? [`AI风控:${parsed.data.riskAssessments[index].riskLevel}`] : []),
              ]),
            ),
          },
        }),
      ),
    );

    return Response.json({ success: true, data: created });
  } catch {
    return Response.json({ success: false, message: "保存 AI 文案失败" }, { status: 500 });
  }
}
