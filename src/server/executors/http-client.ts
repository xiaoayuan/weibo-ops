import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";

import { createProxyAgent } from "@/server/proxy-agent";
import type { ProxyConfig } from "@/server/proxy-config";

type RequestOptions = {
  url: string;
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
  proxyConfig?: ProxyConfig | null;
};

export type HttpClientResult = {
  ok: boolean;
  status: number;
  finalUrl: string;
  headers: Record<string, string>;
  text: string;
  json?: unknown;
};

type RetryOptions = {
  retries?: number;
  retryDelayMs?: number;
  retryOnStatuses?: number[];
};

const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36";

function toHeaderRecord(headers: Record<string, string | string[] | undefined>) {
  const entries = Object.entries(headers).flatMap(([key, value]) => {
    if (value === undefined) {
      return [];
    }

    return [[key, Array.isArray(value) ? value.join(", ") : value] as const];
  });

  return Object.fromEntries(entries);
}

async function performRequest(options: RequestOptions, redirectCount = 0): Promise<HttpClientResult> {
  if (redirectCount > 5) {
    throw new Error("请求重定向次数过多");
  }

  const requestUrl = new URL(options.url);
  const requestFn = requestUrl.protocol === "https:" ? httpsRequest : httpRequest;
  const agent = createProxyAgent(options.url, options.proxyConfig);

  return new Promise<HttpClientResult>((resolve, reject) => {
    const request = requestFn(
      requestUrl,
      {
        method: options.method ?? "GET",
        headers: {
          "User-Agent": DEFAULT_USER_AGENT,
          Accept: "application/json, text/plain, */*",
          ...options.headers,
        },
        agent,
      },
      (response) => {
        const status = response.statusCode ?? 0;
        const location = response.headers.location;

        if (location && [301, 302, 303, 307, 308].includes(status)) {
          response.resume();

          const nextUrl = new URL(location, requestUrl).toString();
          const nextMethod = status === 303 ? "GET" : options.method;
          const nextBody = status === 303 ? undefined : options.body;

          performRequest(
            {
              ...options,
              url: nextUrl,
              method: nextMethod,
              body: nextBody,
            },
            redirectCount + 1,
          )
            .then(resolve)
            .catch(reject);
          return;
        }

        const buffers: Buffer[] = [];
        response.on("data", (chunk) => {
          buffers.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        });
        response.on("end", () => {
          const text = Buffer.concat(buffers).toString("utf8");
          let json: unknown;

          try {
            json = JSON.parse(text);
          } catch {
            json = undefined;
          }

          resolve({
            ok: status >= 200 && status < 300,
            status,
            finalUrl: requestUrl.toString(),
            headers: toHeaderRecord(response.headers),
            text,
            json,
          });
        });
      },
    );

    request.on("error", reject);
    request.setTimeout(options.timeoutMs ?? 15_000, () => {
      request.destroy(new Error("请求超时"));
    });

    if (options.body) {
      request.write(options.body);
    }

    request.end();
  });
}

export async function sendHttpRequest(options: RequestOptions): Promise<HttpClientResult> {
  return performRequest(options);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function sendHttpRequestWithRetry(options: RequestOptions, retryOptions?: RetryOptions): Promise<HttpClientResult> {
  const retries = retryOptions?.retries ?? 0;
  const retryDelayMs = retryOptions?.retryDelayMs ?? 600;
  const retryOnStatuses = new Set(retryOptions?.retryOnStatuses ?? [408, 425, 429, 500, 502, 503, 504]);

  let attempt = 0;

  while (true) {
    try {
      const response = await sendHttpRequest(options);

      if (attempt >= retries || !retryOnStatuses.has(response.status)) {
        return response;
      }
    } catch (error) {
      if (attempt >= retries) {
        throw error;
      }
    }

    attempt += 1;
    await sleep(retryDelayMs * attempt);
  }
}
