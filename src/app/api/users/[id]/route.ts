import { hashPassword } from "@/lib/auth";
import { requireApiRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { updateUserSchema } from "@/server/validators/user";

export async function PATCH(request: Request, context: RouteContext<"/api/users/[id]">) {
  const auth = await requireApiRole("ADMIN");

  if (!auth.ok) {
    return auth.response;
  }

  const { id } = await context.params;

  try {
    const body = await request.json();
    const parsed = updateUserSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json({ success: false, message: "参数校验失败", errors: parsed.error.flatten() }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { id } });

    if (!existing) {
      return Response.json({ success: false, message: "用户不存在" }, { status: 404 });
    }

    const user = await prisma.user.update({
      where: { id },
      data: {
        role: parsed.data.role,
        passwordHash:
          parsed.data.password && parsed.data.password !== ""
            ? await hashPassword(parsed.data.password)
            : undefined,
      },
      select: {
        id: true,
        username: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return Response.json({ success: true, data: user });
  } catch {
    return Response.json({ success: false, message: "更新用户失败" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext<"/api/users/[id]">) {
  const auth = await requireApiRole("ADMIN");

  if (!auth.ok) {
    return auth.response;
  }

  const { id } = await context.params;

  try {
    const existing = await prisma.user.findUnique({ where: { id } });

    if (!existing) {
      return Response.json({ success: false, message: "用户不存在" }, { status: 404 });
    }

    if (existing.id === auth.session.id) {
      return Response.json({ success: false, message: "不能删除当前登录用户" }, { status: 400 });
    }

    await prisma.user.delete({ where: { id } });
    return Response.json({ success: true, message: "删除成功" });
  } catch {
    return Response.json({ success: false, message: "删除用户失败" }, { status: 500 });
  }
}
