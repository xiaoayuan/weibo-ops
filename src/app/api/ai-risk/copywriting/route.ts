import { requireApiRole } from "@/lib/permissions";
import { assessCopywritingCandidates } from "@/server/ai-risk";
import { assessCopywritingRiskSchema } from "@/server/validators/ai-risk";

export async function POST(request: Request) {
  const auth = await requireApiRole("OPERATOR");
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const body = await request.json();
    const parsed = assessCopywritingRiskSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json({ success: false, message: "参数校验失败", errors: parsed.error.flatten() }, { status: 400 });
    }

    const data = await assessCopywritingCandidates(parsed.data);
    return Response.json({ success: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI 文案预审失败";
    return Response.json({ success: false, message }, { status: 500 });
  }
}
