import { requireApiRole } from "@/lib/permissions";
import { executionStrategySchema, getExecutionStrategy, saveExecutionStrategy } from "@/server/strategy/config";

export async function GET() {
  const auth = await requireApiRole("ADMIN");

  if (!auth.ok) {
    return auth.response;
  }

  try {
    const config = await getExecutionStrategy();
    return Response.json({ success: true, data: config });
  } catch {
    return Response.json({ success: false, message: "读取执行策略失败" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const auth = await requireApiRole("ADMIN");

  if (!auth.ok) {
    return auth.response;
  }

  try {
    const body = await request.json();
    const parsed = executionStrategySchema.safeParse(body);

    if (!parsed.success) {
      return Response.json({ success: false, message: "执行策略格式不正确", errors: parsed.error.flatten() }, { status: 400 });
    }

    const config = await saveExecutionStrategy(parsed.data);
    return Response.json({ success: true, data: config, message: "执行策略已保存" });
  } catch {
    return Response.json({ success: false, message: "保存执行策略失败" }, { status: 500 });
  }
}
