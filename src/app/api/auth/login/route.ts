import { serialize } from "cookie";

import { prisma } from "@/lib/prisma";
import { AUTH_COOKIE_NAME, comparePassword, signToken } from "@/lib/auth";
import { loginSchema } from "@/server/validators/auth";

function shouldUseSecureCookie() {
  return process.env.AUTH_COOKIE_SECURE === "true";
}

function buildAuthCookie(token: string) {
  return serialize(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: shouldUseSecureCookie(),
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

async function parseLoginBody(request: Request) {
  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return request.json();
  }

  const formData = await request.formData();

  return {
    username: String(formData.get("username") || ""),
    password: String(formData.get("password") || ""),
  };
}

function wantsRedirect(request: Request) {
  return new URL(request.url).searchParams.get("redirect") === "1";
}

function buildRedirectResponse(location: string, headers?: Record<string, string>) {
  return new Response(null, {
    status: 303,
    headers: {
      Location: location,
      ...headers,
    },
  });
}

function buildFailureResponse(request: Request, message: string, status: number, errors?: unknown) {
  if (wantsRedirect(request)) {
    return buildRedirectResponse(`/login?error=${encodeURIComponent(message)}`);
  }

  return Response.json({ success: false, message, errors }, { status });
}

export async function POST(request: Request) {
  try {
    const body = await parseLoginBody(request);
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return buildFailureResponse(request, "参数校验失败", 400, parsed.error.flatten());
    }

    const user = await prisma.user.findUnique({
      where: { username: parsed.data.username },
    });

    if (!user) {
      return buildFailureResponse(request, "用户名或密码错误", 401);
    }

    const matched = await comparePassword(parsed.data.password, user.passwordHash);

    if (!matched) {
      return buildFailureResponse(request, "用户名或密码错误", 401);
    }

    const token = signToken({
      id: user.id,
      username: user.username,
      role: user.role,
    });

    const authCookie = buildAuthCookie(token);

    if (wantsRedirect(request)) {
      return buildRedirectResponse("/", { "Set-Cookie": authCookie });
    }

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
          "Set-Cookie": authCookie,
        },
      },
    );
  } catch (error) {
    console.error("auth login failed", error);
    return buildFailureResponse(request, "登录失败", 500);
  }
}
