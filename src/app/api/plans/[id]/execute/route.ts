import { requireApiRole } from "@/lib/permissions";
import { executePlanById } from "@/server/plans/execute-plan";

export async function POST(_request: Request, context: RouteContext<"/api/plans/[id]/execute">) {
  const auth = await requireApiRole("OPERATOR");

  if (!auth.ok) {
    return auth.response;
  }

  const { id } = await context.params;

  try {
    const result = await executePlanById(id);

    if (!result.ok) {
      return Response.json({ success: false, message: result.message }, { status: result.status });
    }

    return Response.json({ success: result.success, data: result.data, message: result.message });
  } catch {
    return Response.json({ success: false, message: "执行计划失败" }, { status: 500 });
  }
}
