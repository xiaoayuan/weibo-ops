import { sendHttpRequest } from "@/server/executors/http-client";

type SuggestedBusinessType = "DAILY_PLAN" | "QUICK_REPLY" | "COMMENT_CONTROL" | "REPOST_ROTATION";
type SuggestedTone = "NATURAL" | "PASSERBY" | "SUPPORTIVE" | "DISCUSSIVE" | "LIVELY";

function decodeHtml(text: string) {
  return text
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&nbsp;", " ");
}

function normalizeText(text: string) {
  return decodeHtml(text)
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function readMetaContent(html: string, key: string) {
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${key}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${key}["']`, "i"),
    new RegExp(`<meta[^>]+name=["']${key}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${key}["']`, "i"),
  ];

  for (const pattern of patterns) {
    const matched = html.match(pattern);
    if (matched?.[1]) {
      return normalizeText(matched[1]);
    }
  }

  return null;
}

function readTitle(html: string) {
  const matched = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return matched?.[1] ? normalizeText(matched[1]) : null;
}

function extractContentFromHtml(html: string) {
  const scriptCandidates = [
    ...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi),
    ...html.matchAll(/render_data\s*=\s*\[\{[\s\S]*?status\s*:\s*"([\s\S]*?)"[\s\S]*?text\s*:\s*"([\s\S]*?)"/gi),
  ]
    .map((match) => normalizeText(match[1] || match[2] || ""))
    .filter((item) => item.length >= 10);

  const candidates = [
    ...scriptCandidates,
    readMetaContent(html, "og:description"),
    readMetaContent(html, "description"),
    readMetaContent(html, "twitter:description"),
  ].filter(Boolean) as string[];

  const cleaned = candidates
    .map((item) => item.replace(/^微博正文[:：]?/, "").trim())
    .filter((item) => item.length >= 6);

  return cleaned[0] || null;
}

function suggestBusinessType(content: string): SuggestedBusinessType {
  if (/抽奖|转发|带话题|扩散|控评|评论区|统一口径/i.test(content)) {
    return "COMMENT_CONTROL";
  }

  if (/转发|扩|帮转|轮转/i.test(content)) {
    return "REPOST_ROTATION";
  }

  if (/求问|怎么看|有没有|有人知道|为什么|如何|吗[？?]?$/i.test(content)) {
    return "QUICK_REPLY";
  }

  return "DAILY_PLAN";
}

function suggestTone(content: string): SuggestedTone {
  if (/哈哈|hh|笑死|可爱|啊啊|呜呜|太绝了/i.test(content)) {
    return "LIVELY";
  }

  if (/支持|冲|加油|喜欢|好看|真不错/i.test(content)) {
    return "SUPPORTIVE";
  }

  if (/我觉得|感觉|怎么看|讨论|其实/i.test(content)) {
    return "DISCUSSIVE";
  }

  if (/路过|围观|吃瓜|看到/i.test(content)) {
    return "PASSERBY";
  }

  return "NATURAL";
}

function buildRecommendedContext(title: string, content: string) {
  return [`标题：${title}`, `微博正文：${content}`, "请围绕这条微博内容生成更像真人表达的互动文案。"].join("\n");
}

export async function fetchWeiboLinkPreview(targetUrl: string) {
  const response = await sendHttpRequest({
    url: targetUrl,
    method: "GET",
    headers: {
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
    timeoutMs: 15_000,
  });

  if (!response.ok) {
    throw new Error(`链接抓取失败：${response.status}`);
  }

  const title = readTitle(response.text);
  const content = extractContentFromHtml(response.text);

  if (!title && !content) {
    throw new Error("未能从该链接提取正文内容");
  }

  return {
    title: title || "微博内容预览",
    content: content || title || "",
    finalUrl: response.finalUrl,
    suggestedBusinessType: suggestBusinessType(content || title || ""),
    suggestedTone: suggestTone(content || title || ""),
    recommendedContext: buildRecommendedContext(title || "微博内容预览", content || title || ""),
  };
}
