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
