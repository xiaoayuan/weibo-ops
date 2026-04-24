import { extractStatusIdFromUrl } from "@/server/plans/first-comment-plan";
import { sendHttpRequestWithRetry } from "@/server/executors/http-client";

export type HotCommentItem = {
  commentId: string;
  sourceUrl: string;
  text: string;
  author: string;
  likeCount?: number;
};

function stripHtml(text: string) {
  return text
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toNumber(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

export async function fetchHotComments(targetUrl: string, limit: number, keywords: string[] = []) {
  const statusId = extractStatusIdFromUrl(targetUrl);

  if (!statusId) {
    throw new Error("未能从微博链接中识别微博 ID");
  }

  const endpoint = `https://m.weibo.cn/comments/hotflow?id=${encodeURIComponent(statusId)}&mid=${encodeURIComponent(statusId)}&max_id_type=0`;
  const response = await sendHttpRequestWithRetry(
    {
      url: endpoint,
      method: "GET",
      headers: {
        Accept: "application/json, text/plain, */*",
        Referer: targetUrl,
      },
      timeoutMs: 12_000,
    },
    { retries: 1 },
  );

  if (!response.ok || !response.json || typeof response.json !== "object") {
    throw new Error("热门评论抓取失败");
  }

  const root = response.json as Record<string, unknown>;
  const rootOk = toNumber(root.ok);
  const rootMessage = typeof root.msg === "string" ? root.msg : typeof root.message === "string" ? root.message : undefined;

  if (rootOk !== undefined && rootOk !== 1 && rootOk !== 200) {
    throw new Error(rootMessage || "微博热门评论接口未返回成功结果");
  }

  const data = root.data && typeof root.data === "object" ? (root.data as Record<string, unknown>) : null;
  const comments = Array.isArray(data?.data) ? (data?.data as unknown[]) : [];

  const items: HotCommentItem[] = [];

  for (const comment of comments) {
    if (!comment || typeof comment !== "object") {
      continue;
    }

    const record = comment as Record<string, unknown>;
    const commentId = typeof record.id === "string" ? record.id : typeof record.id === "number" ? String(record.id) : undefined;

    if (!commentId) {
      continue;
    }

    const user = record.user && typeof record.user === "object" ? (record.user as Record<string, unknown>) : null;
    const author = typeof user?.screen_name === "string" ? user.screen_name : "未知用户";
    const text = stripHtml(typeof record.text === "string" ? record.text : "");

    const normalizedText = text.toLowerCase();
    const matchedKeywords = keywords.filter((keyword) => normalizedText.includes(keyword.toLowerCase()));

    if (keywords.length > 0 && matchedKeywords.length === 0) {
      continue;
    }

    items.push({
      commentId,
      sourceUrl: `https://weibo.cn/comment/${commentId}`,
      text,
      author,
      likeCount: toNumber(record.like_counts ?? record.likeCount),
    });

    if (items.length >= limit) {
      break;
    }
  }

  if (items.length === 0) {
    throw new Error("未提取到热门评论，可能该微博暂无可用评论或接口受限");
  }

  return {
    statusId,
    items,
  };
}
