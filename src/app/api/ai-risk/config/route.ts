import { requireApiRole } from "@/lib/permissions";
import { getAiRiskConfig, saveAiRiskConfig } from "@/server/ai-risk-config";

export async function GET() {
  const auth = await requireApiRole("VIEWER");
  if (!auth.ok) {
    return auth.response;
  }

  const data = await getAiRiskConfig();
  return Response.json({ success: true, data });
}

export async function PUT(request: Request) {
  const auth = await requireApiRole("OPERATOR");
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const body = (await request.json()) as { riskyKeywords?: unknown };
    const riskyKeywords = Array.isArray(body.riskyKeywords) ? body.riskyKeywords.filter((item): item is string => typeof item === "string") : [];
    const data = await saveAiRiskConfig({ riskyKeywords });
    return Response.json({ success: true, data });
  } catch {
    return Response.json({ success: false, message: "保存风险词配置失败" }, { status: 500 });
  }
}
