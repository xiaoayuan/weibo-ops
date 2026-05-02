import { serialize } from "cookie";

import { AUTH_COOKIE_NAME, signToken } from "@/src/lib/auth";
import { encryptText } from "@/src/lib/encrypt";
import { hashPassword } from "@/src/lib/password";
import { requireApiRole } from "@/src/lib/permissions";
import { prisma } from "@/src/lib/prisma";
import { sanitizeProxySettings } from "@/src/lib/proxy-config";
import { updateProfileSchema } from "@/src/lib/validators";

function shouldUseSecureCookie() {
  return process.env.AUTH_COOKIE_SECURE === "true";
}

function toProfilePayload(user: {
  id: string;
  username: string;
  role: string;
  proxyEnabled: boolean | null;
  proxyProtocol: "HTTP" | "HTTPS" | "SOCKS5" | null;
  proxyHost: string | null;
  proxyPort: number | null;
  proxyUsername: string | null;
  proxyPasswordEncrypted: string | null;
  taskConcurrency: number | null;
  autoGenerateEnabled: boolean | null;
  autoGenerateWindowStart: string | null;
  autoGenerateWindowEnd: string | null;
  autoExecuteEnabled: boolean | null;
  autoExecuteStartTime: string | null;
  autoExecuteEndTime: string | null;
}) {
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    ...sanitizeProxySettings({
      proxyEnabled: user.proxyEnabled ?? undefined,
      proxyProtocol: user.proxyProtocol ?? undefined,
      proxyHost: user.proxyHost ?? undefined,
      proxyPort: user.proxyPort ?? undefined,
      proxyUsername: user.proxyUsername ?? undefined,
      proxyPasswordEncrypted: user.proxyPasswordEncrypted ?? undefined,
    }),
    taskConcurrency: user.taskConcurrency,
    autoGenerateEnabled: user.autoGenerateEnabled,
    autoGenerateWindowStart: user.autoGenerateWindowStart,
    autoGenerateWindowEnd: user.autoGenerateWindowEnd,
    autoExecuteEnabled: user.autoExecuteEnabled,
    autoExecuteStartTime: user.autoExecuteStartTime,
    autoExecuteEndTime: user.autoExecuteEndTime,
  };
}

export async function GET() {
  const auth = await requireApiRole("VIEWER");
  if (!auth.ok) {
    return auth.response;
  }

  const user = await prisma.user.findUnique({
    where: { id: auth.session.id },
    select: {
      id: true,
      username: true,
      role: true,
      proxyEnabled: true,
      proxyProtocol: true,
      proxyHost: true,
      proxyPort: true,
      proxyUsername: true,
      proxyPasswordEncrypted: true,
      taskConcurrency: true,
      autoGenerateEnabled: true,
      autoGenerateWindowStart: true,
      autoGenerateWindowEnd: true,
      autoExecuteEnabled: true,
      autoExecuteStartTime: true,
      autoExecuteEndTime: true,
    },
  });

  if (!user) {
    return Response.json({ success: false, message: "用户不存在" }, { status: 404 });
  }

  return Response.json({ success: true, data: toProfilePayload(user) });
}

export async function PATCH(request: Request) {
  const auth = await requireApiRole("VIEWER");
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const body = await request.json();
    const parsed = updateProfileSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json({ success: false, message: "参数校验失败", errors: parsed.error.flatten() }, { status: 400 });
    }

    const nextUsername = parsed.data.username?.trim();
    const nextPassword = parsed.data.password;
    const proxyHost = parsed.data.proxyHost?.trim() || null;
    const proxyUsername = parsed.data.proxyUsername?.trim() || null;
    const proxyPassword = parsed.data.proxyPassword;

    if (nextUsername && nextUsername !== auth.session.username) {
      const existed = await prisma.user.findUnique({ where: { username: nextUsername } });
      if (existed) {
        return Response.json({ success: false, message: "用户名已存在" }, { status: 400 });
      }
    }

    const updated = await prisma.user.update({
      where: { id: auth.session.id },
      data: {
        username: nextUsername || undefined,
        passwordHash: nextPassword && nextPassword !== "" ? await hashPassword(nextPassword) : undefined,
        proxyEnabled: parsed.data.proxyEnabled,
        proxyProtocol: parsed.data.proxyProtocol,
        proxyHost,
        proxyPort: parsed.data.proxyPort ?? null,
        proxyUsername,
        taskConcurrency: parsed.data.taskConcurrency,
        autoGenerateEnabled: parsed.data.autoGenerateEnabled,
        autoGenerateWindowStart: parsed.data.autoGenerateWindowStart,
        autoGenerateWindowEnd: parsed.data.autoGenerateWindowEnd,
        autoExecuteEnabled: parsed.data.autoExecuteEnabled,
        autoExecuteStartTime: parsed.data.autoExecuteStartTime,
        autoExecuteEndTime: parsed.data.autoExecuteEndTime,
        proxyPasswordEncrypted:
          proxyPassword !== undefined ? (proxyPassword === "" ? null : encryptText(proxyPassword)) : undefined,
      },
      select: {
        id: true,
        username: true,
        role: true,
        proxyEnabled: true,
        proxyProtocol: true,
        proxyHost: true,
        proxyPort: true,
        proxyUsername: true,
        proxyPasswordEncrypted: true,
        taskConcurrency: true,
        autoGenerateEnabled: true,
        autoGenerateWindowStart: true,
        autoGenerateWindowEnd: true,
        autoExecuteEnabled: true,
        autoExecuteStartTime: true,
        autoExecuteEndTime: true,
      },
    });

    const token = signToken({ id: updated.id, username: updated.username, role: updated.role });

    return new Response(JSON.stringify({ success: true, data: toProfilePayload(updated), message: "账号信息已更新" }), {
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
    });
  } catch {
    return Response.json({ success: false, message: "更新账号信息失败" }, { status: 500 });
  }
}
