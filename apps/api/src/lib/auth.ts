import jwt from "jsonwebtoken";

export const AUTH_COOKIE_NAME = "weibo_ops_token";

const JWT_SECRET = process.env.JWT_SECRET;

function getJwtSecret() {
  if (!JWT_SECRET || JWT_SECRET.length < 32) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("JWT_SECRET 未配置或长度不足，生产环境拒绝启动");
    }
    return "dev-secret-for-local-development-only";
  }
  return JWT_SECRET;
}

export type SessionUser = {
  id: string;
  username: string;
  role: "ADMIN" | "OPERATOR" | "VIEWER";
};

export function signToken(payload: SessionUser) {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: "7d" });
}

export function verifyToken(token: string): SessionUser | null {
  try {
    return jwt.verify(token, getJwtSecret()) as SessionUser;
  } catch {
    return null;
  }
}
