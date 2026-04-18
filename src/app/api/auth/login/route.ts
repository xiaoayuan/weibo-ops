import { serialize } from "cookie";

import { prisma } from "@/lib/prisma";
import { AUTH_COOKIE_NAME, comparePassword, signToken } from "@/lib/auth";
import { loginSchema } from "@/server/validators/auth";

function shouldUseSecureCookie() {
  return process.env.AUTH_COOKIE_SECURE === "true";
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json({ success: false, message: "参数校验失败", errors: parsed.error.flatten() }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { username: parsed.data.username },
    });

    if (!user) {
      return Response.json({ success: false, message: "用户名或密码错误" }, { status: 401 });
    }

    const matched = await comparePassword(parsed.data.password, user.passwordHash);

    if (!matched) {
      return Response.json({ success: false, message: "用户名或密码错误" }, { status: 401 });
    }

    const token = signToken({
      id: user.id,
      username: user.username,
      role: user.role,
    });

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          id: user.id,
          username: user.username,
          role: user.role,
        },
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Set-Cookie": serialize(AUTH_COOKIE_NAME, token, {
            httpOnly: true,
            sameSite: "lax",
            secure: shouldUseSecureCookie(),
            path: "/",
            maxAge: 60 * 60 * 24 * 7,
          }),
        },
      },
    );
  } catch {
    return Response.json({ success: false, message: "登录失败" }, { status: 500 });
  }
}
