import { HttpProxyAgent } from "http-proxy-agent";
import { HttpsProxyAgent } from "https-proxy-agent";
import { SocksProxyAgent } from "socks-proxy-agent";

import type { ProxyConfig } from "@/src/lib/proxy-config";

function toProxyUrl(config: ProxyConfig) {
  const protocol = config.protocol === "SOCKS5" ? "socks5" : config.protocol.toLowerCase();
  const auth = config.username
    ? `${encodeURIComponent(config.username)}${config.password ? `:${encodeURIComponent(config.password)}` : ""}@`
    : "";

  return `${protocol}://${auth}${config.host}:${config.port}`;
}

export function createProxyAgent(targetUrl: string, proxyConfig?: ProxyConfig | null) {
  if (!proxyConfig?.enabled) {
    return undefined;
  }

  const proxyUrl = toProxyUrl(proxyConfig);

  if (proxyConfig.protocol === "SOCKS5") {
    return new SocksProxyAgent(proxyUrl);
  }

  const isHttpsTarget = new URL(targetUrl).protocol === "https:";
  return isHttpsTarget ? new HttpsProxyAgent(proxyUrl) : new HttpProxyAgent(proxyUrl);
}
