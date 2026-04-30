import type { SessionUser } from "@/src/lib/auth";

export type AppRole = SessionUser["role"];

const roleWeight: Record<AppRole, number> = {
  VIEWER: 1,
  OPERATOR: 2,
  ADMIN: 3,
};

export function hasRequiredRole(role: AppRole, requiredRole: AppRole) {
  return roleWeight[role] >= roleWeight[requiredRole];
}
