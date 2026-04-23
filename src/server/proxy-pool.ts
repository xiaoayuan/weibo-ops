import { decryptText, encryptText } from "@/lib/encrypt";
import { prisma } from "@/lib/prisma";
import type { ProxyProtocol } from "@/server/proxy-config";

const DEFAULT_MAX_ACCOUNTS = 100;

export type ProxyNodeInput = {
  name: string;
  protocol: ProxyProtocol;
  host: string;
  port: number;
  username?: string;
  password?: string;
  enabled?: boolean;
  maxAccounts?: number;
};

export async function listProxyNodes(ownerUserId: string) {
  return prisma.proxyNode.findMany({
    where: { ownerUserId },
    include: {
      _count: {
        select: { accounts: true },
      },
    },
    orderBy: [{ enabled: "desc" }, { createdAt: "asc" }],
  });
}

function toCreatePayload(ownerUserId: string, input: ProxyNodeInput) {
  return {
    ownerUserId,
    name: input.name.trim(),
    protocol: input.protocol,
    host: input.host.trim(),
    port: input.port,
    username: input.username?.trim() ? input.username.trim() : null,
    passwordEncrypted: input.password?.trim() ? encryptText(input.password.trim()) : null,
    enabled: input.enabled ?? true,
    maxAccounts: input.maxAccounts ?? DEFAULT_MAX_ACCOUNTS,
  };
}

function toUpdatePayload(input: Partial<ProxyNodeInput>) {
  return {
    name: input.name !== undefined ? input.name.trim() : undefined,
    protocol: input.protocol,
    host: input.host !== undefined ? input.host.trim() : undefined,
    port: input.port,
    username: input.username !== undefined ? (input.username.trim() ? input.username.trim() : null) : undefined,
    passwordEncrypted:
      input.password !== undefined ? (input.password.trim() ? encryptText(input.password.trim()) : null) : undefined,
    enabled: input.enabled,
    maxAccounts: input.maxAccounts,
  };
}

export async function createProxyNode(ownerUserId: string, input: ProxyNodeInput) {
  return prisma.proxyNode.create({
    data: toCreatePayload(ownerUserId, input),
  });
}

export async function updateProxyNode(ownerUserId: string, id: string, input: Partial<ProxyNodeInput>) {
  const existing = await prisma.proxyNode.findFirst({ where: { id, ownerUserId } });

  if (!existing) {
    throw new Error("代理节点不存在");
  }

  return prisma.proxyNode.update({
    where: { id },
    data: toUpdatePayload(input),
  });
}

export async function deleteProxyNode(ownerUserId: string, id: string) {
  const existing = await prisma.proxyNode.findFirst({ where: { id, ownerUserId } });

  if (!existing) {
    throw new Error("代理节点不存在");
  }

  await prisma.proxyNode.delete({ where: { id } });
}

export async function getAutoAssignableProxyNode(ownerUserId: string, excludedNodeIds: string[] = []) {
  const nodes = await prisma.proxyNode.findMany({
    where: {
      ownerUserId,
      enabled: true,
      ...(excludedNodeIds.length > 0 ? { id: { notIn: excludedNodeIds } } : {}),
    },
    include: {
      _count: {
        select: { accounts: true },
      },
    },
    orderBy: [{ createdAt: "asc" }],
  });

  if (nodes.length === 0) {
    throw new Error("暂无可用代理，请先在系统设置中添加并启用代理节点");
  }

  const candidate = nodes
    .filter((node) => node._count.accounts < node.maxAccounts)
    .sort((a, b) => {
      if (a._count.accounts !== b._count.accounts) {
        return a._count.accounts - b._count.accounts;
      }

      return a.createdAt.getTime() - b.createdAt.getTime();
    })[0];

  if (!candidate) {
    throw new Error("代理节点容量已满（每个IP最多100账号），请新增代理节点后再创建账号");
  }

  return candidate;
}

export async function assignProxyForAccount(accountId: string) {
  const account = await prisma.weiboAccount.findUnique({
    where: { id: accountId },
    select: { id: true, ownerUserId: true, proxyNodeId: true },
  });

  if (!account?.ownerUserId) {
    throw new Error("账号不存在或未绑定所属用户");
  }

  if (account.proxyNodeId) {
    return account.proxyNodeId;
  }

  const node = await getAutoAssignableProxyNode(account.ownerUserId);

  await prisma.weiboAccount.update({
    where: { id: account.id },
    data: { proxyNodeId: node.id },
  });

  return node.id;
}

export async function assignMissingProxyNodes(ownerUserId: string) {
  const accounts = await prisma.weiboAccount.findMany({
    where: {
      ownerUserId,
      proxyNodeId: null,
    },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });

  for (const account of accounts) {
    await assignProxyForAccount(account.id);
  }

  return accounts.length;
}

export async function reassignAccountsForProxyNode(
  ownerUserId: string,
  proxyNodeId: string,
  options?: { allowUnbindWhenInsufficientCapacity?: boolean },
) {
  const node = await prisma.proxyNode.findFirst({ where: { id: proxyNodeId, ownerUserId } });

  if (!node) {
    throw new Error("代理节点不存在");
  }

  const accounts = await prisma.weiboAccount.findMany({
    where: { ownerUserId, proxyNodeId },
    select: { id: true },
  });

  if (accounts.length === 0) {
    return;
  }

  const candidates = await prisma.proxyNode.findMany({
    where: {
      ownerUserId,
      enabled: true,
      id: { not: proxyNodeId },
    },
    include: {
      _count: {
        select: { accounts: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const totalFree = candidates.reduce((sum, item) => sum + Math.max(0, item.maxAccounts - item._count.accounts), 0);

  if (totalFree < accounts.length) {
    if (options?.allowUnbindWhenInsufficientCapacity) {
      await prisma.weiboAccount.updateMany({
        where: { ownerUserId, proxyNodeId },
        data: { proxyNodeId: null },
      });

      return {
        reassignedCount: 0,
        unboundCount: accounts.length,
      };
    }

    throw new Error("其余代理容量不足，无法迁移绑定账号，请先新增代理或释放容量");
  }

  const loadMap = new Map(candidates.map((item) => [item.id, item._count.accounts]));

  await prisma.$transaction(async (tx) => {
    for (const account of accounts) {
      const sorted = candidates
        .filter((candidate) => (loadMap.get(candidate.id) || 0) < candidate.maxAccounts)
        .sort((a, b) => {
          const loadA = loadMap.get(a.id) || 0;
          const loadB = loadMap.get(b.id) || 0;

          if (loadA !== loadB) {
            return loadA - loadB;
          }

          return a.createdAt.getTime() - b.createdAt.getTime();
        });

      const targetNode = sorted[0];

      if (!targetNode) {
        throw new Error("代理自动重分配失败，请重试");
      }

      await tx.weiboAccount.update({
        where: { id: account.id },
        data: { proxyNodeId: targetNode.id },
      });

      loadMap.set(targetNode.id, (loadMap.get(targetNode.id) || 0) + 1);
    }
  });

  return {
    reassignedCount: accounts.length,
    unboundCount: 0,
  };
}

export async function getProxyConfigForBoundNode(accountId: string) {
  const account = await prisma.weiboAccount.findUnique({
    where: { id: accountId },
    select: {
      proxyNode: {
        select: {
          enabled: true,
          protocol: true,
          host: true,
          port: true,
          username: true,
          passwordEncrypted: true,
        },
      },
    },
  });

  const node = account?.proxyNode;

  if (!node?.enabled) {
    return null;
  }

  return {
    enabled: true,
    protocol: node.protocol,
    host: node.host,
    port: node.port,
    username: node.username || undefined,
    password: node.passwordEncrypted ? decryptText(node.passwordEncrypted) : undefined,
  };
}

export async function getProxyConfigForNode(ownerUserId: string, nodeId: string) {
  const node = await prisma.proxyNode.findFirst({
    where: { id: nodeId, ownerUserId },
    select: {
      id: true,
      name: true,
      enabled: true,
      protocol: true,
      host: true,
      port: true,
      username: true,
      passwordEncrypted: true,
    },
  });

  if (!node) {
    throw new Error("代理节点不存在");
  }

  return {
    id: node.id,
    name: node.name,
    enabled: node.enabled,
    proxyConfig: {
      enabled: true,
      protocol: node.protocol,
      host: node.host,
      port: node.port,
      username: node.username || undefined,
      password: node.passwordEncrypted ? decryptText(node.passwordEncrypted) : undefined,
    },
  };
}
