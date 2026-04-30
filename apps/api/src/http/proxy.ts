import { getLegacyBackendOrigin } from "../lib/legacy-backend";

const excludedRequestHeaders = new Set(["connection", "content-length", "host"]);
const excludedResponseHeaders = new Set(["content-encoding", "content-length", "transfer-encoding"]);

function buildProxyHeaders(request: Request) {
  const headers = new Headers();

  request.headers.forEach((value, key) => {
    if (!excludedRequestHeaders.has(key.toLowerCase())) {
      headers.set(key, value);
    }
  });

  return headers;
}

function filterResponseHeaders(source: Headers) {
  const headers = new Headers();

  source.forEach((value, key) => {
    if (!excludedResponseHeaders.has(key.toLowerCase())) {
      headers.append(key, value);
    }
  });

  return headers;
}

export async function proxyToLegacyBackend(request: Request, path: string) {
  const incomingUrl = new URL(request.url);
  const targetUrl = new URL(`${path}${incomingUrl.search}`, getLegacyBackendOrigin());
  const headers = buildProxyHeaders(request);
  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  const body = hasBody ? await request.arrayBuffer() : undefined;

  const upstream = await fetch(targetUrl, {
    method: request.method,
    headers,
    body,
    cache: "no-store",
    redirect: "manual",
  });

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: filterResponseHeaders(upstream.headers),
  });
}
