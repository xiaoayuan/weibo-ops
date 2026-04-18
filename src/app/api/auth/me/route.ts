import { cookies } from "next/headers";

import { AUTH_COOKIE_NAME, verifyToken } from "@/lib/auth";

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;

  if (!token) {
    return Response.json({ success: false, message: "未登录" }, { status: 401 });
  }

  const session = verifyToken(token);

  if (!session) {
    return Response.json({ success: false, message: "登录态无效" }, { status: 401 });
  }

  return Response.json({ success: true, data: session });
}
