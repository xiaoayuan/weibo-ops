import { requireApiRole } from "@/lib/permissions";
import { assessTaskRisk } from "@/server/ai-risk";
import { assessTaskRiskSchema } from "@/server/validators/ai-risk";

export async function POST(request: Request) {
  const auth = await requireApiRole("OPERATOR");
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const body = await request.json();
    const parsed = assessTaskRiskSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json({ success: false, message: "参数校验失败", errors: parsed.error.flatten() }, { status: 400 });
    }

    const data = await assessTaskRisk(parsed.data);
    return Response.json({ success: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI 任务风险评估失败";
    return Response.json({ success: false, message }, { status: 500 });
  }
}
