import { getBackendOrigin } from "@/lib/backend";

const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "host",
  "content-length",
]);

const BODYLESS_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const PROXIED_RESPONSE_HEADERS = new Set(["content-type", "set-cookie"]);

type RouteContext = {
  params: Promise<{ path?: string[] }>;
};

function buildBackendUrl(request: Request, path: string[]) {
  const incomingUrl = new URL(request.url);
  const backendUrl = new URL(`/api/${path.map(encodeURIComponent).join("/")}`, getBackendOrigin());
  backendUrl.search = incomingUrl.search;

  return backendUrl;
}

function buildRequestHeaders(request: Request) {
  const headers = new Headers();

  request.headers.forEach((value, key) => {
    if (!HOP_BY_HOP_HEADERS.has(key.toLowerCase())) {
      headers.set(key, value);
    }
  });

  return headers;
}

function buildResponseHeaders(response: Response) {
  const headers = new Headers();

  response.headers.forEach((value, key) => {
    if (PROXIED_RESPONSE_HEADERS.has(key.toLowerCase())) {
      headers.append(key, value);
    }
  });

  return headers;
}

async function proxyApiRequest(request: Request, context: RouteContext) {
  const { path = [] } = await context.params;
  const method = request.method.toUpperCase();
  const hasBody = !BODYLESS_METHODS.has(method);

  const backendResponse = await fetch(buildBackendUrl(request, path), {
    method,
    headers: buildRequestHeaders(request),
    body: hasBody ? await request.arrayBuffer() : undefined,
    cache: "no-store",
    redirect: "manual",
  });

  return new Response(method === "HEAD" ? null : backendResponse.body, {
    status: backendResponse.status,
    statusText: backendResponse.statusText,
    headers: buildResponseHeaders(backendResponse),
  });
}

export const GET = proxyApiRequest;
export const POST = proxyApiRequest;
export const PUT = proxyApiRequest;
export const PATCH = proxyApiRequest;
export const DELETE = proxyApiRequest;
export const HEAD = proxyApiRequest;
export const OPTIONS = proxyApiRequest;
