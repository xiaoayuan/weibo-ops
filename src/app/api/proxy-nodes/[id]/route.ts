import { requireApiRole } from "@/lib/permissions";
import { deleteProxyNode, reassignAccountsForProxyNode, updateProxyNode } from "@/server/proxy-pool";
import { updateProxyNodeSchema } from "@/server/validators/proxy-node";

export async function PATCH(request: Request, context: RouteContext<"/api/proxy-nodes/[id]">) {
  const auth = await requireApiRole("ADMIN");

  if (!auth.ok) {
    return auth.response;
  }

  const { id } = await context.params;

  try {
    const body = await request.json();
    const parsed = updateProxyNodeSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { success: false, message: "参数校验失败", errors: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const updated = await updateProxyNode(auth.session.id, id, {
      ...parsed.data,
      username: parsed.data.username,
      password: parsed.data.password,
    });

    if (parsed.data.enabled === false) {
      await reassignAccountsForProxyNode(auth.session.id, id);
    }

    return Response.json({
      success: true,
      data: {
        id: updated.id,
        name: updated.name,
        protocol: updated.protocol,
        host: updated.host,
        port: updated.port,
        username: updated.username,
        enabled: updated.enabled,
        maxAccounts: updated.maxAccounts,
        hasPassword: Boolean(updated.passwordEncrypted),
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "更新代理节点失败";
    const status = message.includes("不存在") || message.includes("Unique constraint") ? 400 : 500;

    return Response.json({ success: false, message: status === 400 ? message.replace("Unique constraint failed", "同一主机端口已存在") : message }, { status });
  }
}

export async function DELETE(_request: Request, context: RouteContext<"/api/proxy-nodes/[id]">) {
  const auth = await requireApiRole("ADMIN");

  if (!auth.ok) {
    return auth.response;
  }

  const { id } = await context.params;

  try {
    await reassignAccountsForProxyNode(auth.session.id, id);
    await deleteProxyNode(auth.session.id, id);

    return Response.json({ success: true, message: "代理节点已删除" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "删除代理节点失败";
    return Response.json({ success: false, message }, { status: 500 });
  }
}
