import jwt from "jsonwebtoken";

export const AUTH_COOKIE_NAME = "weibo_ops_token";

const JWT_SECRET = process.env.JWT_SECRET;

function getJwtSecret() {
  if (!JWT_SECRET || JWT_SECRET.length < 32) {
    throw new Error("JWT_SECRET 未配置或长度不足，请确保环境变量 JWT_SECRET 至少为 32 个字符");
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
