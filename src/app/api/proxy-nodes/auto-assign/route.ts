import { requireApiRole } from "@/lib/permissions";
import { assignMissingProxyNodes } from "@/server/proxy-pool";

export async function POST() {
  const auth = await requireApiRole("ADMIN");

  if (!auth.ok) {
    return auth.response;
  }

  try {
    const assignedCount = await assignMissingProxyNodes(auth.session.id);

    return Response.json({
      success: true,
      data: { assignedCount },
      message: assignedCount > 0 ? `已自动绑定 ${assignedCount} 个账号` : "当前没有待绑定账号",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "自动分配失败";
    return Response.json({ success: false, message }, { status: 400 });
  }
}
