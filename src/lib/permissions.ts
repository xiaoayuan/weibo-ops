import { redirect } from "next/navigation";
import { cookies } from "next/headers";

import { AUTH_COOKIE_NAME, type SessionUser, verifyToken } from "@/lib/auth";
import { hasRequiredRole as hasRequiredRoleRule } from "@/lib/permission-rules";
import { prisma } from "@/lib/prisma";

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

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: { id: true, username: true, role: true },
  });

  if (!user) {
    return {
      ok: false as const,
      response: Response.json({ success: false, message: "登录已失效，请重新登录" }, { status: 401 }),
    };
  }

  if (!hasRequiredRole(user.role, requiredRole)) {
    return {
      ok: false as const,
      response: Response.json({ success: false, message: "权限不足" }, { status: 403 }),
    };
  }

  return {
    ok: true as const,
    session: user,
  };
}

export async function requirePageRole(requiredRole: SessionUser["role"]) {
  const session = await getSessionUserFromCookies();

  if (!session) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: { id: true, username: true, role: true },
  });

  if (!user) {
    redirect("/login");
  }

  if (!hasRequiredRole(user.role, requiredRole)) {
    redirect("/");
  }

  return user;
}
