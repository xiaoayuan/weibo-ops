import { requireApiRole } from "@/src/lib/permissions";
import { prisma } from "@/src/lib/prisma";
import { createCopywritingSchema } from "@/src/lib/validators";

export async function GET() {
  const auth = await requireApiRole("VIEWER");

  if (!auth.ok) {
    return auth.response;
  }

  const items = await prisma.copywritingTemplate.findMany({
    orderBy: { createdAt: "desc" },
  });

  return Response.json({ success: true, data: items });
}

export async function POST(request: Request) {
  const auth = await requireApiRole("OPERATOR");

  if (!auth.ok) {
    return auth.response;
  }

  try {
    const body = await request.json();
    const parsed = createCopywritingSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json({ success: false, message: "参数校验失败", errors: parsed.error.flatten() }, { status: 400 });
    }

    const item = await prisma.copywritingTemplate.create({
      data: parsed.data,
    });

    return Response.json({ success: true, data: item });
  } catch {
    return Response.json({ success: false, message: "创建文案失败" }, { status: 500 });
  }
}
