import { cookies } from "next/headers";

import { AUTH_COOKIE_NAME, type SessionUser, verifyToken } from "@/src/lib/auth";
import { hasRequiredRole as hasRequiredRoleRule } from "@/src/lib/permission-rules";

export async function getSessionUserFromCookies() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  return verifyToken(token);
}

export function hasRequiredRole(userRole: SessionUser["role"], requiredRole: SessionUser["role"]) {
  return hasRequiredRoleRule(userRole, requiredRole);
}

export async function requireApiRole(requiredRole: SessionUser["role"]) {
  const session = await getSessionUserFromCookies();

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
