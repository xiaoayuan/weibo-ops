import { extractCommentIdFromUrl } from "@/src/lib/comment-link";
import { requireApiRole } from "@/src/lib/permissions";
import { prisma } from "@/src/lib/prisma";
import { batchImportCommentPoolSchema } from "@/src/lib/validators";

export async function POST(request: Request) {
  const auth = await requireApiRole("OPERATOR");

  if (!auth.ok) {
    return auth.response;
  }

  try {
    const body = await request.json();
    const parsed = batchImportCommentPoolSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json({ success: false, message: "参数校验失败", errors: parsed.error.flatten() }, { status: 400 });
    }

    const imported: string[] = [];
    const skipped: Array<{ url: string; reason: string }> = [];

    for (const rawUrl of parsed.data.sourceUrls) {
      const sourceUrl = rawUrl.trim();
      const commentId = extractCommentIdFromUrl(sourceUrl);

      if (!commentId) {
        skipped.push({ url: sourceUrl, reason: "未识别到评论 ID" });
        continue;
      }

      if (!parsed.data.forceDuplicate) {
        const existed = await prisma.commentLinkPoolItem.findFirst({ where: { commentId } });
        if (existed) {
          skipped.push({ url: sourceUrl, reason: "评论 ID 已存在" });
          continue;
        }
      }

      await prisma.commentLinkPoolItem.create({
        data: {
          sourceUrl,
          commentId,
          note: parsed.data.note || null,
          tags: parsed.data.tags || [],
          isForcedDuplicate: parsed.data.forceDuplicate,
        },
      });

      imported.push(sourceUrl);
    }

    return Response.json({ success: true, data: { imported, skipped } });
  } catch {
    return Response.json({ success: false, message: "批量导入控评链接失败" }, { status: 500 });
  }
}
