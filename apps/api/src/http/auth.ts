import { parse } from "cookie";

import { AUTH_COOKIE_NAME, type SessionUser, verifyToken } from "@/src/lib/auth";
import { hasRequiredRole } from "@/src/lib/permission-rules";

export function getSessionFromRequest(request: Request) {
  const cookieHeader = request.headers.get("cookie") || "";
  const cookies = parse(cookieHeader);
  const token = cookies[AUTH_COOKIE_NAME];

  if (!token) {
    return null;
  }

  return verifyToken(token);
}

export function requireApiRole(request: Request, requiredRole: SessionUser["role"]) {
  const session = getSessionFromRequest(request);

  if (!session) {
    return {
      ok: false as const,
      response: Response.json({ success: false, message: "未登录" }, { status: 401 }),
    };
  }

  if (!hasRequiredRole(session.role, requiredRole)) {
    return {
      ok: false as const,
      response: Response.json({ success: false, message: "权限不足" }, { status: 403 }),
    };
  }

  return {
    ok: true as const,
    session,
  };
}
