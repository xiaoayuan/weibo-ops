import { requireApiRole } from "@/src/lib/permissions";
import { getRiskRules, riskRulesSchema, saveRiskRules } from "@/src/lib/risk-rules";

export async function GET() {
  const auth = await requireApiRole("ADMIN");
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const rules = await getRiskRules();
    return Response.json({ success: true, data: rules });
  } catch {
    return Response.json({ success: false, message: "读取风控规则失败" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const auth = await requireApiRole("ADMIN");
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const body = await request.json();
    const parsed = riskRulesSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ success: false, message: "风控规则格式不正确", errors: parsed.error.flatten() }, { status: 400 });
    }

    const rules = await saveRiskRules(parsed.data);
    return Response.json({ success: true, data: rules, message: "风控规则已保存" });
  } catch {
    return Response.json({ success: false, message: "保存风控规则失败，请先执行数据库结构更新" }, { status: 500 });
  }
}
