import { generateDailyPlansWithSummary } from "@/server/plan-generator";
import { generatePlansSchema } from "@/server/validators/plan";
import { requireApiRole } from "@/lib/permissions";

export async function POST(request: Request) {
  const auth = await requireApiRole("OPERATOR");

  if (!auth.ok) {
    return auth.response;
  }

  try {
    const body = await request.json();
    const parsed = generatePlansSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json({ success: false, message: "参数校验失败", errors: parsed.error.flatten() }, { status: 400 });
    }

    const result = await generateDailyPlansWithSummary(parsed.data.date, auth.session.id);
    return Response.json({
      success: true,
      data: result.plans,
      meta: {
        date: parsed.data.date,
        createdCount: result.createdCount,
        existingCount: result.existingCount,
      },
      message:
        result.createdCount > 0
          ? `已为 ${parsed.data.date} 新增 ${result.createdCount} 条计划`
          : `${parsed.data.date} 已存在计划，本次未新增`,
    });
  } catch {
    return Response.json({ success: false, message: "生成计划失败" }, { status: 500 });
  }
}
