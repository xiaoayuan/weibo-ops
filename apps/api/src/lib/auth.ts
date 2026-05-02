import jwt from "jsonwebtoken";

export const AUTH_COOKIE_NAME = "weibo_ops_token";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";

export type SessionUser = {
  id: string;
  username: string;
  role: "ADMIN" | "OPERATOR" | "VIEWER";
};

export function signToken(payload: SessionUser) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string): SessionUser | null {
  try {
    return jwt.verify(token, JWT_SECRET) as SessionUser;
  } catch {
    return null;
  }
}
