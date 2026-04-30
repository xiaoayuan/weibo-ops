import { autoAssignProxyBindingsForOwner } from "@/src/lib/proxy-pool";
import { requireApiRole } from "@/src/lib/permissions";

export async function POST() {
  const auth = await requireApiRole("ADMIN");

  if (!auth.ok) {
    return auth.response;
  }

  try {
    const result = await autoAssignProxyBindingsForOwner(auth.session.id);

    return Response.json({
      success: true,
      message: `自动绑定完成：更新 ${result.updated}/${result.total} 个账号`,
      data: result,
    });
  } catch (error) {
    return Response.json({ success: false, message: error instanceof Error ? error.message : "自动绑定失败" }, { status: 500 });
  }
}
