import { fetchHotComments } from "@/src/lib/hot-comments";
import { requireApiRole } from "@/src/lib/permissions";
import { fetchHotCommentsSchema } from "@/src/lib/validators";

export async function POST(request: Request) {
  const auth = await requireApiRole("OPERATOR");

  if (!auth.ok) {
    return auth.response;
  }

  try {
    const body = await request.json();
    const parsed = fetchHotCommentsSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json({ success: false, message: "参数校验失败", errors: parsed.error.flatten() }, { status: 400 });
    }

    const data = await fetchHotComments(parsed.data.targetUrl, parsed.data.limit, parsed.data.keywords);
    return Response.json({ success: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "提取热门评论失败";
    return Response.json({ success: false, message }, { status: 500 });
  }
}
