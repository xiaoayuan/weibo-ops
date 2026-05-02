import { fetchWeiboLinkPreview } from "@/src/lib/link-preview";
import { requireApiRole } from "@/src/lib/permissions";
import { fetchCopywritingLinkPreviewSchema } from "@/src/lib/validators";

export async function POST(request: Request) {
  const auth = await requireApiRole("OPERATOR");
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const parsed = fetchCopywritingLinkPreviewSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ success: false, message: "参数校验失败", errors: parsed.error.flatten() }, { status: 400 });
    }

    const preview = await fetchWeiboLinkPreview(parsed.data.targetUrl);
    return Response.json({ success: true, data: preview });
  } catch (error) {
    const message = error instanceof Error ? error.message : "链接内容预览失败";
    return Response.json({ success: false, message }, { status: 500 });
  }
}
