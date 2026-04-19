import { hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeExecutionLog } from "@/server/logs";
import { registerSchema } from "@/server/validators/auth";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json({ success: false, message: "参数校验失败", errors: parsed.error.flatten() }, { status: 400 });
    }

    const normalizedCode = parsed.data.inviteCode.trim().toUpperCase();
    const now = new Date();

    const createdUser = await prisma.$transaction(async (tx) => {
      const invite = await tx.inviteCode.findUnique({ where: { code: normalizedCode } });

      if (!invite) {
        throw new Error("注册码不存在");
      }

      if (invite.disabled) {
        throw new Error("注册码已失效");
      }

      if (invite.expiresAt && invite.expiresAt.getTime() <= now.getTime()) {
        throw new Error("注册码已过期");
      }

      if (invite.usedCount >= invite.maxUses) {
        throw new Error("注册码使用次数已达上限");
      }

      const existing = await tx.user.findUnique({ where: { username: parsed.data.username } });

      if (existing) {
        throw new Error("用户名已存在");
      }

      const updated = await tx.inviteCode.updateMany({
        where: {
          id: invite.id,
          disabled: false,
          usedCount: { lt: invite.maxUses },
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
        data: {
          usedCount: { increment: 1 },
          lastUsedBy: parsed.data.username,
          lastUsedAt: now,
          disabled: invite.usedCount + 1 >= invite.maxUses,
        },
      });

      if (updated.count !== 1) {
        throw new Error("注册码当前不可用，请重试");
      }

      return tx.user.create({
        data: {
          username: parsed.data.username,
          passwordHash: await hashPassword(parsed.data.password),
          role: invite.role,
        },
        select: {
          id: true,
          username: true,
          role: true,
        },
      });
    });

    await writeExecutionLog({
      actionType: "USER_REGISTERED_WITH_INVITE",
      requestPayload: {
        username: createdUser.username,
      },
      success: true,
    });

    return Response.json({
      success: true,
      message: "注册成功，请返回登录",
      data: {
        id: createdUser.id,
        username: createdUser.username,
        role: createdUser.role,
      },
    });
  } catch (error) {
    return Response.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "注册失败",
      },
      { status: 400 },
    );
  }
}
