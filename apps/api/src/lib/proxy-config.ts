import { decryptText } from "@/src/lib/encrypt";
import { prisma } from "@/src/lib/prisma";

export type ProxyProtocol = "HTTP" | "HTTPS" | "SOCKS5";

export type ProxyConfig = {
  enabled: boolean;
  protocol: ProxyProtocol;
  host: string;
  port: number;
  username?: string;
  password?: string;
};

export type ProxyConfigInput = {
  proxyEnabled?: boolean;
  proxyProtocol?: ProxyProtocol | null;
  proxyHost?: string | null;
  proxyPort?: number | null;
  proxyUsername?: string | null;
  proxyPassword?: string | null;
};

export type ProxyExecutionCandidate = {
  key: string;
  label: string;
  proxyNodeId?: string | null;
  proxyConfig: ProxyConfig | null;
  useHostNetwork: boolean;
};

function trimOptional(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function buildProxyConfig(input: ProxyConfigInput & { proxyPasswordEncrypted?: string | null }) {
  if (!input.proxyEnabled) {
    return null;
  }

  const protocol = input.proxyProtocol;
  const host = trimOptional(input.proxyHost);
  const port = input.proxyPort;

  if (!protocol || !host || !port) {
    return null;
  }

  const encryptedPassword = trimOptional(input.proxyPasswordEncrypted);
  const password = trimOptional(input.proxyPassword) || (encryptedPassword ? decryptText(encryptedPassword) : undefined);

  return {
    enabled: true,
    protocol,
    host,
    port,
    username: trimOptional(input.proxyUsername),
    password,
  } satisfies ProxyConfig;
}

function buildProxyConfigFromNode(node: {
  protocol: ProxyProtocol;
  host: string;
  port: number;
  username: string | null;
  passwordEncrypted: string | null;
}) {
  return {
    enabled: true,
    protocol: node.protocol,
    host: node.host,
    port: node.port,
    username: node.username || undefined,
    password: node.passwordEncrypted ? decryptText(node.passwordEncrypted) : undefined,
  } satisfies ProxyConfig;
}

export async function getProxyExecutionCandidatesForAccount(accountId: string): Promise<ProxyExecutionCandidate[]> {
  const account = await prisma.weiboAccount.findUnique({
    where: { id: accountId },
    select: {
      proxyNodeId: true,
      backupProxyNodeId: true,
      fallbackProxyNodeId: true,
      allowHostFallback: true,
      owner: {
        select: {
          proxyEnabled: true,
          proxyProtocol: true,
          proxyHost: true,
          proxyPort: true,
          proxyUsername: true,
          proxyPasswordEncrypted: true,
        },
      },
    },
  });

  if (!account) {
    return [{ key: "host", label: "主机直连", proxyConfig: null, useHostNetwork: true }];
  }

  const candidates: ProxyExecutionCandidate[] = [];
  const nodeIds = [account.proxyNodeId, account.backupProxyNodeId, account.fallbackProxyNodeId].filter(
    (value): value is string => Boolean(value),
  );
  const uniqueNodeIds = Array.from(new Set(nodeIds));

  if (uniqueNodeIds.length > 0) {
    const nodes = await prisma.proxyNode.findMany({
      where: {
        id: { in: uniqueNodeIds },
        enabled: true,
      },
      select: {
        id: true,
        name: true,
        protocol: true,
        host: true,
        port: true,
        username: true,
        passwordEncrypted: true,
      },
    });

    const nodeMap = new Map(nodes.map((node) => [node.id, node]));

    const addNodeCandidate = (nodeId: string | null | undefined, key: string, label: string) => {
      if (!nodeId) {
        return;
      }

      const node = nodeMap.get(nodeId);
      if (!node) {
        return;
      }

      candidates.push({
        key,
        label: `${label}: ${node.name}`,
        proxyNodeId: node.id,
        proxyConfig: buildProxyConfigFromNode(node),
        useHostNetwork: false,
      });
    };

    addNodeCandidate(account.proxyNodeId, "primary", "主代理");
    addNodeCandidate(account.backupProxyNodeId, "backup", "备代理1");
    addNodeCandidate(account.fallbackProxyNodeId, "fallback", "备代理2");
  }

  if (candidates.length === 0 && account.owner) {
    const ownerProxy = buildProxyConfig(account.owner);
    if (ownerProxy) {
      candidates.push({
        key: "owner",
        label: "全局代理",
        proxyConfig: ownerProxy,
        useHostNetwork: false,
      });
    }
  }

  if (account.allowHostFallback || candidates.length === 0) {
    candidates.push({ key: "host", label: "主机直连", proxyConfig: null, useHostNetwork: true });
  }

  return candidates;
}

export async function getProxyConfigForAccount(accountId: string) {
  const candidates = await getProxyExecutionCandidatesForAccount(accountId);
  const firstProxyCandidate = candidates.find((item) => item.proxyConfig);

  return firstProxyCandidate?.proxyConfig || null;
}

export function sanitizeProxySettings(input: ProxyConfigInput & { proxyPasswordEncrypted?: string | null }) {
  return {
    proxyEnabled: Boolean(input.proxyEnabled),
    proxyProtocol: input.proxyProtocol || "HTTP",
    proxyHost: input.proxyHost || "",
    proxyPort: input.proxyPort || 0,
    proxyUsername: input.proxyUsername || "",
    proxyPasswordConfigured: Boolean(trimOptional(input.proxyPassword) || trimOptional(input.proxyPasswordEncrypted)),
  };
}
