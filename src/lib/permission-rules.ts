import type { SessionUser } from "@/lib/auth";

export type AppRole = SessionUser["role"];

const roleWeight: Record<AppRole, number> = {
  VIEWER: 1,
  OPERATOR: 2,
  ADMIN: 3,
};

export function hasRequiredRole(role: AppRole, requiredRole: AppRole) {
  return roleWeight[role] >= roleWeight[requiredRole];
}

export function canManageBusinessData(role: AppRole) {
  return hasRequiredRole(role, "OPERATOR");
}

export function canReviewAndExecuteTasks(role: AppRole) {
  return hasRequiredRole(role, "OPERATOR");
}

export function canManageUsers(role: AppRole) {
  return hasRequiredRole(role, "ADMIN");
}

export function canManageSettings(role: AppRole) {
  return hasRequiredRole(role, "ADMIN");
}
