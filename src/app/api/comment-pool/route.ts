import { requireApiRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { extractCommentIdFromUrl } from "@/server/comment-link";
import { createCommentPoolItemSchema } from "@/server/validators/ops";

export async function GET(request: Request) {
  const auth = await requireApiRole("VIEWER");

  if (!auth.ok) {
    return auth.response;
  }

  const { searchParams } = new URL(request.url);
  const keyword = (searchParams.get("keyword") || "").trim();
  const tag = (searchParams.get("tag") || "").trim();

  const items = await prisma.commentLinkPoolItem.findMany({
    where:
      keyword || tag
        ? {
            AND: [
              keyword
                ? {
                    OR: [
                      { sourceUrl: { contains: keyword, mode: "insensitive" } },
                      { commentId: { contains: keyword, mode: "insensitive" } },
                      { note: { contains: keyword, mode: "insensitive" } },
                    ],
                  }
                : {},
              tag ? { tags: { has: tag } } : {},
            ],
          }
        : undefined,
    orderBy: { createdAt: "desc" },
    take: 500,
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
    const parsed = createCommentPoolItemSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json({ success: false, message: "参数校验失败", errors: parsed.error.flatten() }, { status: 400 });
    }

    const sourceUrl = parsed.data.sourceUrl.trim();
    const commentId = extractCommentIdFromUrl(sourceUrl);

    if (!commentId) {
      return Response.json({ success: false, message: "未识别到评论 ID，请检查链接" }, { status: 400 });
    }

    if (!parsed.data.forceDuplicate) {
      const existed = await prisma.commentLinkPoolItem.findFirst({
        where: { commentId },
      });

      if (existed) {
        return Response.json({ success: false, message: "该评论已在控评池中" }, { status: 409 });
      }
    }

    const item = await prisma.commentLinkPoolItem.create({
      data: {
        sourceUrl,
        commentId,
        note: parsed.data.note || null,
        tags: parsed.data.tags || [],
        isForcedDuplicate: Boolean(parsed.data.forceDuplicate),
      },
    });

    return Response.json({ success: true, data: item });
  } catch {
    return Response.json({ success: false, message: "新增控评链接失败" }, { status: 500 });
  }
}
