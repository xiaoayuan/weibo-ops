export type AppRole = "VIEWER" | "OPERATOR" | "ADMIN";

export type SessionUser = {
  id: string;
  username: string;
  role: AppRole;
};

const roleWeight: Record<AppRole, number> = {
  VIEWER: 1,
  OPERATOR: 2,
  ADMIN: 3,
};

export function hasRequiredRole(role: AppRole, requiredRole: AppRole) {
  return roleWeight[role] >= roleWeight[requiredRole];
}

export function getRoleText(role: AppRole) {
  if (role === "ADMIN") {
    return "管理员";
  }

  if (role === "OPERATOR") {
    return "运营";
  }

  return "观察者";
}
