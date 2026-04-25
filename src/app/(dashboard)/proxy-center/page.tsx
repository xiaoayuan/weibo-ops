import { ProxyBindingManager } from "@/components/proxy/proxy-binding-manager";
import { ProxyPoolForm } from "@/components/settings/proxy-pool-form";
import { requirePageRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function ProxyCenterPage() {
  const session = await requirePageRole("ADMIN");

  const [nodes, accounts] = await Promise.all([
    prisma.proxyNode.findMany({
      where: { ownerUserId: session.id },
      include: {
        _count: {
          select: { accounts: true },
        },
      },
      orderBy: [{ enabled: "desc" }, { createdAt: "asc" }],
    }),
    prisma.weiboAccount.findMany({
      where: { ownerUserId: session.id },
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

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold">代理中心</h2>
        <p className="mt-1 text-sm text-slate-500">集中管理代理池、账号主备绑定和自动绑定策略。</p>
      </div>

      <ProxyPoolForm
        initialNodes={nodes.map((node) => ({
          id: node.id,
          name: node.name,
          protocol: node.protocol,
          rotationMode: node.rotationMode,
          countryCode: node.countryCode,
          host: node.host,
          port: node.port,
          username: node.username,
          enabled: node.enabled,
          maxAccounts: node.maxAccounts,
          assignedAccounts: node._count.accounts,
          hasPassword: Boolean(node.passwordEncrypted),
        }))}
      />

      <ProxyBindingManager
        initialNodes={nodes.map((node) => ({
          id: node.id,
          name: node.name,
          host: node.host,
          port: node.port,
          countryCode: node.countryCode,
          enabled: node.enabled,
        }))}
        initialAccounts={accounts}
      />
    </div>
  );
}
