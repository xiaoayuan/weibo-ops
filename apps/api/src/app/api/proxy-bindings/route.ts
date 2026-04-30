import { requireApiRole } from "@/src/lib/permissions";
import { prisma } from "@/src/lib/prisma";

export async function GET() {
  const auth = await requireApiRole("ADMIN");

  if (!auth.ok) {
    return auth.response;
  }

  const [nodes, accounts] = await Promise.all([
    prisma.proxyNode.findMany({
      where: { ownerUserId: auth.session.id },
      include: {
        _count: {
          select: { accounts: true },
        },
      },
      orderBy: [{ enabled: "desc" }, { createdAt: "asc" }],
    }),
    prisma.weiboAccount.findMany({
      where: { ownerUserId: auth.session.id },
      select: {
        id: true,
        nickname: true,
        groupName: true,
        status: true,
        proxyNodeId: true,
        backupProxyNodeId: true,
        fallbackProxyNodeId: true,
        proxyBindingMode: true,
        proxyBindingLocked: true,
        allowHostFallback: true,
      },
      orderBy: [{ groupName: "asc" }, { createdAt: "asc" }],
    }),
  ]);

  return Response.json({
    success: true,
    data: {
      nodes: nodes.map((node: (typeof nodes)[number]) => ({
        id: node.id,
        name: node.name,
        protocol: node.protocol,
        rotationMode: node.rotationMode,
        countryCode: node.countryCode,
        host: node.host,
        port: node.port,
        enabled: node.enabled,
        assignedAccounts: node._count.accounts,
      })),
      accounts,
    },
  });
}
