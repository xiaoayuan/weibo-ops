import { prisma } from "@/lib/prisma";
import { requireApiRole } from "@/lib/permissions";
import { z } from "zod";

const payloadSchema = z.object({
  proxyNodeId: z.string().nullable().optional(),
  backupProxyNodeId: z.string().nullable().optional(),
  fallbackProxyNodeId: z.string().nullable().optional(),
  proxyBindingMode: z.enum(["AUTO", "MANUAL"]).optional(),
  proxyBindingLocked: z.boolean().optional(),
  allowHostFallback: z.boolean().optional(),
});

export async function PATCH(request: Request, context: RouteContext<"/api/proxy-bindings/[id]">) {
  const auth = await requireApiRole("ADMIN");

  if (!auth.ok) {
    return auth.response;
  }

  const { id } = await context.params;

  try {
    const body = await request.json();
    const parsed = payloadSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json({ success: false, message: "参数校验失败", errors: parsed.error.flatten() }, { status: 400 });
    }

    const account = await prisma.weiboAccount.findUnique({
      where: { id },
      select: { id: true, ownerUserId: true },
    });

    if (!account || account.ownerUserId !== auth.session.id) {
      return Response.json({ success: false, message: "账号不存在" }, { status: 404 });
    }

    const candidateIds = [
      parsed.data.proxyNodeId,
      parsed.data.backupProxyNodeId,
      parsed.data.fallbackProxyNodeId,
    ].filter((value): value is string => Boolean(value));

    if (candidateIds.length > 0) {
      const nodes = await prisma.proxyNode.findMany({
        where: {
          ownerUserId: auth.session.id,
          id: { in: candidateIds },
        },
        select: { id: true, enabled: true },
      });

      if (nodes.length !== candidateIds.length) {
        return Response.json({ success: false, message: "包含无效代理节点" }, { status: 400 });
      }

      const disabledNode = nodes.find((node) => !node.enabled);

      if (disabledNode) {
        return Response.json({ success: false, message: "不能绑定已停用代理节点" }, { status: 400 });
      }
    }

    const hasDuplicate = new Set(candidateIds).size !== candidateIds.length;

    if (hasDuplicate) {
      return Response.json({ success: false, message: "主备代理不能重复" }, { status: 400 });
    }

    const updated = await prisma.weiboAccount.update({
      where: { id },
      data: {
        proxyNodeId: parsed.data.proxyNodeId,
        backupProxyNodeId: parsed.data.backupProxyNodeId,
        fallbackProxyNodeId: parsed.data.fallbackProxyNodeId,
        proxyBindingMode: parsed.data.proxyBindingMode,
        proxyBindingLocked: parsed.data.proxyBindingLocked,
        allowHostFallback: parsed.data.allowHostFallback,
      },
      select: {
        id: true,
        proxyNodeId: true,
        backupProxyNodeId: true,
        fallbackProxyNodeId: true,
        proxyBindingMode: true,
        proxyBindingLocked: true,
        allowHostFallback: true,
      },
    });

    return Response.json({ success: true, data: updated });
  } catch (error) {
    return Response.json({ success: false, message: error instanceof Error ? error.message : "保存失败" }, { status: 500 });
  }
}
