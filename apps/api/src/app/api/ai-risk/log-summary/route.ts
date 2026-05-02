import { summarizeFailureRisk } from "@/src/lib/ai-risk";
import { requireApiRole } from "@/src/lib/permissions";
import { summarizeFailureRiskSchema } from "@/src/lib/validators";

export async function POST(request: Request) {
  const auth = await requireApiRole("VIEWER");
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const parsed = summarizeFailureRiskSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ success: false, message: "参数校验失败", errors: parsed.error.flatten() }, { status: 400 });
    }

    const data = await summarizeFailureRisk(parsed.data);
    return Response.json({ success: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI 日志总结失败";
    return Response.json({ success: false, message }, { status: 500 });
  }
}
