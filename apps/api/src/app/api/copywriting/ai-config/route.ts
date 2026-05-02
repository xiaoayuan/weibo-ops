import { getAiCopywritingConfig, saveAiCopywritingConfig } from "@/src/lib/ai-copywriting-config";
import { requireApiRole } from "@/src/lib/permissions";
import { saveAiConfigSchema } from "@/src/lib/validators";

export async function GET() {
  const auth = await requireApiRole("VIEWER");
  if (!auth.ok) return auth.response;

  const config = await getAiCopywritingConfig();
  return Response.json({ success: true, data: config });
}

export async function PUT(request: Request) {
  const auth = await requireApiRole("ADMIN");
  if (!auth.ok) return auth.response;

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
