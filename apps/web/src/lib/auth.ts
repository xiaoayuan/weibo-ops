import { redirect } from "next/navigation";

import { hasRequiredRole, type AppRole } from "@/lib/auth-shared";
import { fetchServerApi } from "@/lib/backend";
import type { SessionUser } from "@/lib/auth-shared";

export async function getSession() {
  const response = await fetchServerApi<SessionUser>("/api/auth/me");

  if (!response.ok || !response.payload?.success) {
    return null;
  }

  return response.payload.data;
}

export async function requireSession() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  return session;
}

export async function requireRole(requiredRole: AppRole) {
  const session = await requireSession();

  if (!hasRequiredRole(session.role, requiredRole)) {
    redirect("/");
  }

  return session;
}

export async function redirectIfAuthenticated() {
  const session = await getSession();

  if (session) {
    redirect("/");
  }
}
