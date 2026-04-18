type RequestOptions = {
  url: string;
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
};

export type HttpClientResult = {
  ok: boolean;
  status: number;
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

function toHeaderRecord(headers: Headers) {
  return Object.fromEntries(headers.entries());
}

export async function sendHttpRequest(options: RequestOptions): Promise<HttpClientResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 15_000);

  try {
    const response = await fetch(options.url, {
      method: options.method ?? "GET",
      headers: {
        "User-Agent": DEFAULT_USER_AGENT,
        Accept: "application/json, text/plain, */*",
        ...options.headers,
      },
      body: options.body,
      signal: controller.signal,
      cache: "no-store",
    });

    const text = await response.text();
    let json: unknown;

    try {
      json = JSON.parse(text);
    } catch {
      json = undefined;
    }

    return {
      ok: response.ok,
      status: response.status,
      headers: toHeaderRecord(response.headers),
      text,
      json,
    };
  } finally {
    clearTimeout(timeout);
  }
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
