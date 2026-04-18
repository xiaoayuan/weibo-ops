import { generateDailyPlans } from "@/server/plan-generator";
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

    const plans = await generateDailyPlans(parsed.data.date);
    return Response.json({ success: true, data: plans });
  } catch {
    return Response.json({ success: false, message: "生成计划失败" }, { status: 500 });
  }
}
