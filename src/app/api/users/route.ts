import { hashPassword } from "@/lib/auth";
import { requireApiRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { createUserSchema } from "@/server/validators/user";

export async function GET() {
  const auth = await requireApiRole("ADMIN");

  if (!auth.ok) {
    return auth.response;
  }

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      username: true,
      role: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return Response.json({ success: true, data: users });
}

export async function POST(request: Request) {
  const auth = await requireApiRole("ADMIN");

  if (!auth.ok) {
    return auth.response;
  }

  try {
    const body = await request.json();
    const parsed = createUserSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json({ success: false, message: "参数校验失败", errors: parsed.error.flatten() }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { username: parsed.data.username } });

    if (existing) {
      return Response.json({ success: false, message: "用户名已存在" }, { status: 400 });
    }

    const user = await prisma.user.create({
      data: {
        username: parsed.data.username,
        passwordHash: await hashPassword(parsed.data.password),
        role: parsed.data.role,
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
    return Response.json({ success: false, message: "创建用户失败" }, { status: 500 });
  }
}
