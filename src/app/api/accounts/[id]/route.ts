import { prisma } from "@/lib/prisma";
import { requireApiRole } from "@/lib/permissions";
import { createAccountSchema } from "@/server/validators/account";

export async function GET(_request: Request, context: RouteContext<"/api/accounts/[id]">) {
  const { id } = await context.params;

  const account = await prisma.weiboAccount.findUnique({
    where: { id },
  });

  if (!account) {
    return Response.json(
      {
        success: false,
        message: "账号不存在",
      },
      { status: 404 },
    );
  }

  return Response.json({
    success: true,
    data: account,
  });
}

export async function PATCH(request: Request, context: RouteContext<"/api/accounts/[id]">) {
  const auth = await requireApiRole("OPERATOR");

  if (!auth.ok) {
    return auth.response;
  }

  const { id } = await context.params;

  try {
    const body = await request.json();
    const parsed = createAccountSchema.partial().safeParse(body);

    if (!parsed.success) {
      return Response.json(
        {
          success: false,
          message: "参数校验失败",
          errors: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    const existing = await prisma.weiboAccount.findUnique({
      where: { id },
    });

    if (!existing) {
      return Response.json(
        {
          success: false,
          message: "账号不存在",
        },
        { status: 404 },
      );
    }

    const account = await prisma.weiboAccount.update({
      where: { id },
      data: {
        nickname: parsed.data.nickname,
        remark: parsed.data.remark === "" ? null : parsed.data.remark,
        groupName: parsed.data.groupName === "" ? null : parsed.data.groupName,
        status: parsed.data.status,
      },
    });

    return Response.json({
      success: true,
      data: account,
    });
  } catch {
    return Response.json(
      {
        success: false,
        message: "更新账号失败",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: Request, context: RouteContext<"/api/accounts/[id]">) {
  const auth = await requireApiRole("OPERATOR");

  if (!auth.ok) {
    return auth.response;
  }

  const { id } = await context.params;

  try {
    const existing = await prisma.weiboAccount.findUnique({
      where: { id },
    });

    if (!existing) {
      return Response.json(
        {
          success: false,
          message: "账号不存在",
        },
        { status: 404 },
      );
    }

    await prisma.weiboAccount.delete({
      where: { id },
    });

    return Response.json({
      success: true,
      message: "删除成功",
    });
  } catch {
    return Response.json(
      {
        success: false,
        message: "删除账号失败",
      },
      { status: 500 },
    );
  }
}
