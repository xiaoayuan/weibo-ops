import { prisma } from "@/lib/prisma";
import { requireApiRole } from "@/lib/permissions";
import { createCopywritingSchema } from "@/server/validators/copywriting";

export async function GET() {
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
