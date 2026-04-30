import type { NextRequest } from "next/server";

const excludedRequestHeaders = new Set([
  "connection",
  "content-length",
  "host",
]);

const excludedResponseHeaders = new Set([
  "content-encoding",
  "content-length",
  "transfer-encoding",
]);

export function getLegacyBackendOrigin() {
  return process.env.LEGACY_BACKEND_ORIGIN || "http://127.0.0.1:3007";
}

function buildProxyHeaders(request: NextRequest) {
  const headers = new Headers();

  request.headers.forEach((value, key) => {
    if (!excludedRequestHeaders.has(key.toLowerCase())) {
      headers.set(key, value);
    }
  });

  headers.set("x-forwarded-host", request.headers.get("host") || "");
  headers.set("x-forwarded-proto", request.nextUrl.protocol.replace(":", ""));

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

export async function proxyToLegacyBackend(request: NextRequest, pathSegments: string[] = []) {
  const search = request.nextUrl.search || "";
  const path = pathSegments.length > 0 ? `/api/${pathSegments.join("/")}` : "/api";
  const targetUrl = new URL(`${path}${search}`, getLegacyBackendOrigin());
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
