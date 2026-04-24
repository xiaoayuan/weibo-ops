import { sendHttpRequest } from "@/server/executors/http-client";

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
  const candidates = [
    readMetaContent(html, "og:description"),
    readMetaContent(html, "description"),
    readMetaContent(html, "twitter:description"),
  ].filter(Boolean) as string[];

  const cleaned = candidates
    .map((item) => item.replace(/^微博正文[:：]?/, "").trim())
    .filter((item) => item.length >= 6);

  return cleaned[0] || null;
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
  };
}
