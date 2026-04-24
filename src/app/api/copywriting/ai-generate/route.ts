import { requireApiRole } from "@/lib/permissions";
import { generateAiCopywriting } from "@/server/copywriting/ai";
import { generateAiCopywritingSchema } from "@/server/validators/copywriting";

export async function POST(request: Request) {
  const auth = await requireApiRole("OPERATOR");

  if (!auth.ok) {
    return auth.response;
  }

  try {
    const body = await request.json();
    const parsed = generateAiCopywritingSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json({ success: false, message: "参数校验失败", errors: parsed.error.flatten() }, { status: 400 });
    }

    const result = await generateAiCopywriting(parsed.data);
    return Response.json({ success: true, data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI 文案生成失败";
    return Response.json({ success: false, message }, { status: 500 });
  }
}
