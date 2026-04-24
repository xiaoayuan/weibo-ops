import { requireApiRole } from "@/lib/permissions";
import { getAiCopywritingConfig, saveAiCopywritingConfig } from "@/server/copywriting/ai-config";
import { saveAiConfigSchema } from "@/server/validators/copywriting";

export async function GET() {
  const auth = await requireApiRole("VIEWER");

  if (!auth.ok) {
    return auth.response;
  }

  const config = await getAiCopywritingConfig();
  return Response.json({ success: true, data: config });
}

export async function PUT(request: Request) {
  const auth = await requireApiRole("OPERATOR");

  if (!auth.ok) {
    return auth.response;
  }

  try {
    const body = await request.json();
    const parsed = saveAiConfigSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json({ success: false, message: "参数校验失败", errors: parsed.error.flatten() }, { status: 400 });
    }

    const config = await saveAiCopywritingConfig({
      baseUrl: parsed.data.baseUrl,
      model: parsed.data.model,
      apiKey: parsed.data.apiKey || undefined,
    });

    return Response.json({ success: true, data: config });
  } catch {
    return Response.json({ success: false, message: "保存 AI 接口配置失败" }, { status: 500 });
  }
}
