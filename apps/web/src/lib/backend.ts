import { cookies } from "next/headers";

export type ApiEnvelope<T> = {
  success: boolean;
  message?: string;
  data?: T;
};

export function getBackendOrigin() {
  return process.env.BACKEND_ORIGIN || "http://127.0.0.1:3007";
}

function toCookieHeader(values: Awaited<ReturnType<typeof cookies>>) {
  return values
    .getAll()
    .map((item) => `${item.name}=${item.value}`)
    .join("; ");
}

export async function fetchServerApi<T>(path: string, init?: RequestInit) {
  const cookieStore = await cookies();
  const cookieHeader = toCookieHeader(cookieStore);

  try {
    const response = await fetch(new URL(path, getBackendOrigin()), {
      ...init,
      cache: "no-store",
      headers: {
        accept: "application/json",
        ...(cookieHeader ? { cookie: cookieHeader } : {}),
        ...(init?.headers || {}),
      },
    });

    const payload = (await response.json().catch(() => null)) as ApiEnvelope<T> | null;

    return {
      ok: response.ok,
      status: response.status,
      payload,
      error: null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "后端服务不可达";

    return {
      ok: false,
      status: 0,
      payload: null,
      error: `后端服务不可达：${message}`,
    };
  }
}
