import { sendHttpRequestWithRetry } from "@/server/executors/http-client";
import type { ProxyConfig } from "@/server/proxy-config";

type CookieMap = Record<string, string>;

function parseCookieMap(cookie: string): CookieMap {
  return cookie
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce<CookieMap>((acc, item) => {
      const index = item.indexOf("=");

      if (index <= 0) {
        return acc;
      }

      const key = item.slice(0, index).trim();
      const value = item.slice(index + 1).trim();

      if (!key) {
        return acc;
      }

      acc[key] = value;
      return acc;
    }, {});
}

function getXsrfToken(cookie: string) {
  const cookieMap = parseCookieMap(cookie);

  for (const key of ["XSRF-TOKEN", "XSRF_TOKEN", "XSRFToken", "_xsrf", "xsrf"]) {
    if (cookieMap[key]) {
      return decodeURIComponent(cookieMap[key]);
    }
  }

  return undefined;
}

function extractTopicContainerId(topicUrl?: string | null) {
  if (!topicUrl) {
    return undefined;
  }

  const patterns = [
    /containerid=([a-zA-Z0-9]{6,})/i,
    /topicid=([a-zA-Z0-9]{6,})/i,
    /super(?:_index)?\/([a-zA-Z0-9]{6,})/i,
    /\/p\/([a-zA-Z0-9]{10,})\//i,
  ];

  for (const pattern of patterns) {
    const matched = topicUrl.match(pattern);

    if (matched?.[1]) {
      return matched[1];
    }
  }

  return undefined;
}

type CandidatePost = {
  id: string;
  commentsCount?: number;
  targetUrl: string;
};

function readNumber(value: unknown) {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

export function extractStatusIdFromUrl(targetUrl: string) {
  const candidates: string[] = [targetUrl.trim()];
  let decoded = targetUrl;

  for (let i = 0; i < 3; i += 1) {
    try {
      const next = decodeURIComponent(decoded);

      if (next === decoded) {
        break;
      }

      decoded = next;
      candidates.push(decoded);
    } catch {
      break;
    }
  }

  const patterns = [
    /[?&](?:mid|id|weibo_id|bid)=([a-zA-Z0-9]+)/i,
    /\/\d+\/([a-zA-Z0-9]+)/i,
    /\/u\/\d+\/([a-zA-Z0-9]+)/i,
    /\/status\/([a-zA-Z0-9]+)/i,
    /\/detail\/([a-zA-Z0-9]+)/i,
  ];

  for (const candidate of candidates) {
    for (const pattern of patterns) {
      const matched = candidate.match(pattern);

      if (matched?.[1]) {
        return matched[1];
      }
    }

    const longDigits = candidate.match(/(\d{15,20})/g);

    if (longDigits && longDigits.length > 0) {
      return longDigits[0];
    }
  }

  return undefined;
}

function collectCandidatePosts(payload: unknown, fallbackTopicUrl: string): CandidatePost[] {
  const queue: unknown[] = [payload];
  const collected: CandidatePost[] = [];
  const seen = new Set<string>();

  while (queue.length > 0) {
    const current = queue.shift();

    if (!current || typeof current !== "object") {
      continue;
    }

    if (Array.isArray(current)) {
      for (const item of current) {
        queue.push(item);
      }

      continue;
    }

    const record = current as Record<string, unknown>;
    const idRaw = record.idstr || record.id;
    const commentsCount = readNumber(record.comments_count ?? record.commentsCount);

    if (idRaw) {
      const id = String(idRaw);

      if (!seen.has(id)) {
        seen.add(id);

        const userId = String(
          (record.user && typeof record.user === "object" ? (record.user as Record<string, unknown>).idstr || (record.user as Record<string, unknown>).id : "") ||
            "",
        );
        const bid = String(record.mblogid || "");
        const targetUrl = userId && bid ? `https://weibo.com/${userId}/${bid}` : fallbackTopicUrl;

        collected.push({ id, commentsCount, targetUrl });
      }
    }

    for (const value of Object.values(record)) {
      if (value && (Array.isArray(value) || typeof value === "object")) {
        queue.push(value);
      }
    }
  }

  return collected;
}

function getTimelineEndpoints(topicUrl: string, containerId?: string) {
  const configured = process.env.WEIBO_FIRST_COMMENT_TIMELINE_ENDPOINTS
    ?.split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  const templates =
    configured && configured.length > 0
      ? configured
      : [
          "https://weibo.com/ajax/statuses/super_timeline?containerid={containerid}&page=1",
          "https://weibo.com/ajax/statuses/superTimeline?containerid={containerid}&page=1",
          "https://weibo.com/ajax/statuses/container_timeline?containerid={containerid}&page=1",
        ];

  return templates.map((template) =>
    template
      .replaceAll("{containerid}", encodeURIComponent(containerId || ""))
      .replaceAll("{topic_url_enc}", encodeURIComponent(topicUrl)),
  );
}

function collectStatusIdsFromTopicHtml(html: string) {
  const ids: string[] = [];
  const patterns = [
    /"id":"(\d{15,20})"/g,
    /"mid":"(\d{15,20})"/g,
    /\bmid=(\d{15,20})\b/g,
  ];

  for (const pattern of patterns) {
    for (const matched of html.matchAll(pattern)) {
      if (matched[1]) {
        ids.push(matched[1]);
      }
    }
  }

  return Array.from(new Set(ids));
}

async function fetchLatestPostsFromTopicPage(topicUrl: string, cookie: string, limit: number, proxyConfig?: ProxyConfig | null) {
  const response = await sendHttpRequestWithRetry(
    {
      url: topicUrl,
      method: "GET",
      headers: {
        Cookie: cookie,
        Referer: "https://weibo.com/",
      },
      timeoutMs: 12_000,
      proxyConfig,
    },
    {
      retries: 1,
    },
  );

  if (!response.ok) {
    return [] as CandidatePost[];
  }

  const ids = collectStatusIdsFromTopicHtml(response.text).slice(0, limit);

  return ids.map((id) => ({
    id,
    commentsCount: undefined,
    targetUrl: topicUrl,
  }));
}

export async function fetchLatestPosts(topicUrl: string, cookie: string, limit: number, proxyConfig?: ProxyConfig | null) {
  const pagePosts = await fetchLatestPostsFromTopicPage(topicUrl, cookie, limit, proxyConfig);

  if (pagePosts.length >= limit) {
    return pagePosts.slice(0, limit);
  }

  const containerId = extractTopicContainerId(topicUrl);
  const endpoints = getTimelineEndpoints(topicUrl, containerId);
  const allPosts: CandidatePost[] = [...pagePosts];

  for (const endpoint of endpoints) {
    try {
      const response = await sendHttpRequestWithRetry(
        {
          url: endpoint,
          method: "GET",
          headers: {
            Cookie: cookie,
            Referer: topicUrl,
            "X-Requested-With": "XMLHttpRequest",
          },
          timeoutMs: 12_000,
          proxyConfig,
        },
        {
          retries: 1,
        },
      );

      const payload = response.json ?? response.text;
      const posts = collectCandidatePosts(payload, topicUrl);

      if (posts.length > 0) {
        allPosts.push(...posts);

        if (allPosts.length >= limit) {
          break;
        }
      }
    } catch {
      continue;
    }
  }

  const deduped = new Map<string, CandidatePost>();

  for (const post of allPosts) {
    if (!deduped.has(post.id)) {
      deduped.set(post.id, post);
    }
  }

  return Array.from(deduped.values()).slice(0, limit);
}

function isCommentCreated(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  const record = payload as Record<string, unknown>;

  if (typeof record.id === "number" || (typeof record.id === "string" && record.id.trim())) {
    return true;
  }

  if (typeof record.idstr === "string" && record.idstr.trim()) {
    return true;
  }

  if (record.data && typeof record.data === "object") {
    return isCommentCreated(record.data);
  }

  if (typeof record.ok === "number") {
    return record.ok === 1;
  }

  return false;
}

export async function sendFirstComment(statusId: string, targetUrl: string, commentText: string, cookie: string, proxyConfig?: ProxyConfig | null) {
  return sendStatusComment(statusId, targetUrl, commentText, cookie, proxyConfig);
}

export async function sendStatusComment(statusId: string, targetUrl: string, commentText: string, cookie: string, proxyConfig?: ProxyConfig | null) {
  const endpoint = process.env.WEIBO_FIRST_COMMENT_CREATE_ENDPOINT || "https://weibo.com/ajax/comments/create";
  const xsrfToken = getXsrfToken(cookie);

  const body = new URLSearchParams();
  body.set("id", statusId);
  body.set("mid", statusId);
  body.set("comment", commentText);
  body.set("content", commentText);

  const headers: Record<string, string> = {
    Cookie: cookie,
    Referer: targetUrl,
    Origin: "https://weibo.com",
    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    "X-Requested-With": "XMLHttpRequest",
  };

  if (xsrfToken) {
    headers["X-XSRF-TOKEN"] = xsrfToken;
  }

  const response = await sendHttpRequestWithRetry(
    {
      url: endpoint,
      method: "POST",
      headers,
      body: body.toString(),
      timeoutMs: 12_000,
      proxyConfig,
    },
    {
      retries: 1,
    },
  );

  const payload = response.json ?? response.text;
  const success = response.ok && isCommentCreated(payload);

  return {
    success,
    status: response.status,
    payload,
    traffic: {
      requestBytes: response.requestBytes,
      responseBytes: response.responseBytes,
      totalBytes: response.totalBytes,
    },
  };
}

export async function fetchStatusCommentsCount(statusId: string, cookie: string, referer: string, proxyConfig?: ProxyConfig | null) {
  const endpoint = `https://weibo.com/ajax/statuses/show?id=${encodeURIComponent(statusId)}`;
  const response = await sendHttpRequestWithRetry(
    {
      url: endpoint,
      method: "GET",
      headers: {
        Cookie: cookie,
        Referer: referer || "https://weibo.com/",
        "X-Requested-With": "XMLHttpRequest",
      },
      timeoutMs: 12_000,
      proxyConfig,
    },
    {
      retries: 1,
    },
  );

  const payload = response.json;

  if (!response.ok || !payload || typeof payload !== "object") {
    return undefined;
  }

  const record = payload as Record<string, unknown>;
  return readNumber(record.comments_count ?? record.commentsCount);
}

export async function checkStatusIsZeroComments(statusId: string, cookie: string, referer: string, fallbackCount?: number, proxyConfig?: ProxyConfig | null) {
  if (typeof fallbackCount === "number") {
    return fallbackCount === 0;
  }
  const commentsCount = await fetchStatusCommentsCount(statusId, cookie, referer, proxyConfig);

  return commentsCount === 0;
}

export function pickRandomTemplate(templates: string[]) {
  if (templates.length === 0) {
    return "";
  }

  const index = Math.floor(Math.random() * templates.length);
  return templates[index];
}
