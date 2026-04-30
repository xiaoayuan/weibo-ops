import { randomBytes } from "node:crypto";

import { writeExecutionLog } from "@/src/lib/execution-log";
import { requireApiRole } from "@/src/lib/permissions";
import { prisma } from "@/src/lib/prisma";
import { createInviteCodeSchema } from "@/src/lib/validators";

function generateCode() {
  return randomBytes(6).toString("base64url").toUpperCase();
}

export async function GET() {
  const auth = await requireApiRole("ADMIN");

  if (!auth.ok) {
    return auth.response;
  }

  const items = await prisma.inviteCode.findMany({
    orderBy: { createdAt: "desc" },
  });

  return Response.json({ success: true, data: items });
}

export async function POST(request: Request) {
  const auth = await requireApiRole("ADMIN");

  if (!auth.ok) {
    return auth.response;
  }

  try {
    const body = await request.json();
    const parsed = createInviteCodeSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json({ success: false, message: "参数校验失败", errors: parsed.error.flatten() }, { status: 400 });
    }

    const expiresAt = new Date(Date.now() + parsed.data.expiresInHours * 60 * 60 * 1000);
    let lastError: unknown;

    for (let i = 0; i < 5; i += 1) {
      const code = generateCode();

      try {
        const item = await prisma.inviteCode.create({
          data: {
            code,
            role: parsed.data.role,
            maxUses: parsed.data.maxUses,
            expiresAt,
            createdById: auth.session.id,
          },
        });

        await writeExecutionLog({
          actionType: "INVITE_CODE_CREATED",
          requestPayload: {
            role: parsed.data.role,
            maxUses: parsed.data.maxUses,
            expiresInHours: parsed.data.expiresInHours,
          },
          responsePayload: {
            inviteCodeId: item.id,
            code: item.code,
          },
          success: true,
        });

        return Response.json({ success: true, data: item });
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError;
  } catch {
    return Response.json({ success: false, message: "生成注册码失败" }, { status: 500 });
  }
}
