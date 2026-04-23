import { decryptText } from "@/lib/encrypt";
import { prisma } from "@/lib/prisma";
import { getProxyConfigForBoundNode } from "@/server/proxy-pool";

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

function trimOptional(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function buildProxyConfig(input: ProxyConfigInput & { proxyPasswordEncrypted?: string | null }): ProxyConfig | null {
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
  };
}

export async function getProxyConfigForAccount(accountId: string) {
  const boundNodeConfig = await getProxyConfigForBoundNode(accountId);

  if (boundNodeConfig) {
    return boundNodeConfig;
  }

  const account = await prisma.weiboAccount.findUnique({
    where: { id: accountId },
    select: {
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

  if (!account?.owner) {
    return null;
  }

  return buildProxyConfig(account.owner);
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
