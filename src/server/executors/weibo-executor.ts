import { decryptText } from "@/lib/encrypt";
import { prisma } from "@/lib/prisma";
import { sendHttpRequestWithRetry } from "@/server/executors/http-client";
import { validateInteractionPrecheck, validatePlanPrecheck } from "@/server/executors/precheck";
import type { ExecuteInteractionInput, ExecutePlanInput, ExecutorActionResult, SocialExecutor } from "@/server/executors/types";
import { randomUUID } from "node:crypto";

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

function getXsrfToken(cookieMap: CookieMap) {
  for (const key of ["XSRF-TOKEN", "XSRF_TOKEN", "XSRFToken", "_xsrf", "xsrf"]) {
    if (cookieMap[key]) {
      return decodeURIComponent(cookieMap[key]);
    }
  }

  return undefined;
}

function getCheckInEndpoints() {
  const envList = process.env.WEIBO_CHECKIN_ENDPOINTS
    ?.split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  if (envList && envList.length > 0) {
    return envList;
  }

  const primary = process.env.WEIBO_CHECKIN_ENDPOINT || "https://weibo.com/ajax/super/starsign";

  return [primary, "https://weibo.com/ajax/super/checkin"];
}

function getLikeEndpoints() {
  const envList = process.env.WEIBO_LIKE_ENDPOINTS
    ?.split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  if (envList && envList.length > 0) {
    return envList;
  }

  return ["https://weibo.com/ajax/statuses/setLike", "https://weibo.com/aj/v6/like/add?ajwvr=6"];
}

function getCommentLikeEndpoint() {
  return process.env.WEIBO_WEB_COMMENT_LIKE_ENDPOINT || "https://weibo.com/ajax/statuses/updateLike";
}

function getRepostEndpoints() {
  const envList = process.env.WEIBO_REPOST_ENDPOINTS
    ?.split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  if (envList && envList.length > 0) {
    return envList;
  }

  return [
    "https://weibo.com/ajax/statuses/normal_repost",
    "https://weibo.com/aj/v6/mblog/forward?ajwvr=6",
    "https://weibo.com/ajax/statuses/repost",
  ];
}

function getPostEndpoints() {
  const envList = process.env.WEIBO_POST_ENDPOINTS
    ?.split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  if (envList && envList.length > 0) {
    return envList;
  }

  return ["https://weibo.com/ajax/statuses/update", "https://weibo.com/aj/mblog/add?ajwvr=6"];
}

function extractSuperTagId(topicUrl?: string | null) {
  if (!topicUrl) {
    return process.env.WEIBO_DEFAULT_SUPER_TAG_ID;
  }

  const patterns = [
    /__(\d+)_-_tag_comment_sort/i,
    /[?&]super_tag_id=(\d+)/i,
  ];

  for (const pattern of patterns) {
    const matched = topicUrl.match(pattern);

    if (matched?.[1]) {
      return matched[1];
    }
  }

  return process.env.WEIBO_DEFAULT_SUPER_TAG_ID;
}

function toTopicObjectId(topicUrl?: string | null) {
  const raw = tryExtractTopicId(topicUrl);

  if (!raw) {
    return undefined;
  }

  if (raw.includes(":")) {
    return raw;
  }

  return `1022:${raw}`;
}

function toTopicRawId(topicUrl?: string | null) {
  return tryExtractTopicId(topicUrl);
}

function getAppSendEndpoint() {
  const endpoint = process.env.WEIBO_APP_SEND_ENDPOINT || "https://api.weibo.cn/2/statuses/send";
  const query = new URLSearchParams(
    process.env.WEIBO_APP_SEND_QUERY ||
      "aid=01A3HlOH9I_DDX-VXUqpvWcDxsbp96_b3Qf2fmNCXwJo9HqpI.&b=0&c=iphone&dlang=zh-Hans-CN&from=10G4293010&ft=1&lang=zh_CN&networktype=wifi&sflag=1&skin=default&v_f=1&v_p=93&wm=3333_2001",
  );

  const gsid = process.env.WEIBO_APP_GSID;

  if (gsid) {
    query.set("gsid", gsid);
  }

  const url = new URL(endpoint);
  query.forEach((value, key) => {
    url.searchParams.set(key, value);
  });

  return url.toString();
}

function buildAppCallbackUrl(topicObjectId: string) {
  if (process.env.WEIBO_APP_CALLBACK_URL) {
    return process.env.WEIBO_APP_CALLBACK_URL;
  }

  const url = new URL("http://i.huati.weibo.com/super/autoattention/supertopic");
  url.searchParams.set("object_id", topicObjectId);

  return url.toString();
}

function tryExtractTopicId(topicUrl?: string | null) {
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

function tryExtractStatusId(targetUrl?: string | null) {
  if (!targetUrl) {
    return undefined;
  }

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

    const weiboContext =
      candidate.includes("weibo.com") ||
      candidate.includes("m.weibo.cn") ||
      candidate.includes("weibo.cn") ||
      candidate.includes("status") ||
      candidate.includes("detail");

    if (weiboContext) {
      const longDigits = candidate.match(/(\d{15,20})/g);

      if (longDigits && longDigits.length > 0) {
        return longDigits[0];
      }
    }
  }

  return undefined;
}

const BASE62_CHARS = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

function decodeBase62(value: string) {
  let result = 0;

  for (const char of value) {
    const index = BASE62_CHARS.indexOf(char);

    if (index < 0) {
      return undefined;
    }

    result = result * 62 + index;
  }

  return result;
}

function tryDecodeBidToMid(bid: string) {
  if (!/^[0-9a-zA-Z]{6,16}$/.test(bid)) {
    return undefined;
  }

  const chunks: string[] = [];

  for (let end = bid.length; end > 0; end -= 4) {
    const start = Math.max(0, end - 4);
    const part = bid.slice(start, end);
    const decoded = decodeBase62(part);

    if (decoded === undefined) {
      return undefined;
    }

    let numeric = String(decoded);

    if (start > 0) {
      numeric = numeric.padStart(7, "0");
    }

    chunks.unshift(numeric);
  }

  const mid = chunks.join("").replace(/^0+/, "");
  return mid || undefined;
}

function normalizeStatusId(statusId?: string) {
  if (!statusId) {
    return undefined;
  }

  if (/^\d{8,20}$/.test(statusId)) {
    return statusId;
  }

  return tryDecodeBidToMid(statusId) || statusId;
}

function tryExtractCommentId(targetUrl?: string | null) {
  if (!targetUrl) {
    return undefined;
  }

  const candidates: string[] = [targetUrl];

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
    /weibo\.cn\/comment\/([a-zA-Z0-9]{8,})/i,
    /[?&](?:rid|id|object_id)=([a-zA-Z0-9]{8,})/i,
    /reportspam\?[^\n]*?rid=([a-zA-Z0-9]{8,})/i,
    /\brid[=:]([a-zA-Z0-9]{8,})/i,
    /comment\/([a-zA-Z0-9]{8,})/i,
  ];

  for (const candidate of candidates) {
    for (const pattern of patterns) {
      const matched = candidate.match(pattern);

      if (matched?.[1]) {
        return matched[1];
      }
    }

    const commentContext =
      candidate.toLowerCase().includes("weibo.cn/comment/") ||
      candidate.toLowerCase().includes("rid=") ||
      candidate.toLowerCase().includes("object_id=") ||
      candidate.toLowerCase().includes("comment/");

    if (commentContext) {
      const longDigits = candidate.match(/(\d{15,20})/g);

      if (longDigits && longDigits.length > 0) {
        return longDigits[0];
      }
    }
  }

  return undefined;
}

function isCommentLikeLink(targetUrl: string) {
  const text = targetUrl.toLowerCase();

  return (
    text.includes("weibo.cn/comment/") ||
    text.includes("rid=") ||
    text.includes("object_id=") ||
    text.includes("service.account.weibo.com/reportspam")
  );
}

async function resolveLikeTargetUrl(targetUrl: string, cookie: string) {
  try {
    const response = await sendHttpRequestWithRetry(
      {
        url: targetUrl,
        method: "GET",
        headers: {
          Cookie: cookie,
          Referer: "https://weibo.com/",
        },
        timeoutMs: 10_000,
      },
      {
        retries: 1,
      },
    );

    return response.finalUrl || targetUrl;
  } catch {
    return targetUrl;
  }
}

function summarizePayload(payload: unknown) {
  if (typeof payload === "string") {
    return payload.slice(0, 220);
  }

  try {
    return JSON.stringify(payload).slice(0, 220);
  } catch {
    return String(payload);
  }
}

function getHostPlatform() {
  if (process.platform === "darwin") {
    return "MacIntel";
  }

  if (process.platform === "win32") {
    return "Win32";
  }

  return "Linux x86_64";
}

function blockedResult(message: string, responsePayload?: unknown): ExecutorActionResult {
  return {
    success: false,
    status: "FAILED",
    stage: "PRECHECK_BLOCKED",
    message,
    responsePayload,
  };
}

function pendingActionResult(message: string, responsePayload?: unknown): ExecutorActionResult {
  return {
    success: true,
    status: "READY",
    stage: "PRECHECK_PASSED",
    message,
    responsePayload,
  };
}

async function getAccountCookie(accountId: string) {
  const account = await prisma.weiboAccount.findUnique({
    where: { id: accountId },
    select: {
      id: true,
      nickname: true,
      cookieEncrypted: true,
      loginStatus: true,
    },
  });

  if (!account) {
    throw new Error("账号不存在");
  }

  if (!account.cookieEncrypted) {
    throw new Error("账号尚未录入 Cookie");
  }

  return {
    ...account,
    cookie: decryptText(account.cookieEncrypted),
  };
}

async function buildConnectivityProbe(cookie: string) {
  const response = await sendHttpRequestWithRetry({
    url: "https://weibo.com/",
    headers: {
      Cookie: cookie,
      Referer: "https://weibo.com/",
    },
    timeoutMs: 10_000,
  }, {
    retries: 1,
  });

  return {
    ok: response.ok,
    status: response.status,
    summary: response.json ?? response.text.slice(0, 200),
  };
}

async function sendCheckInRequest(input: ExecutePlanInput, cookie: string) {
  const cookieMap = parseCookieMap(cookie);
  const xsrfToken = getXsrfToken(cookieMap);
  const topicId = tryExtractTopicId(input.topicUrl);
  const endpoints = getCheckInEndpoints();
  const now = Date.now();

  const form = new URLSearchParams();
  if (input.topicName) {
    form.set("name", input.topicName);
    form.set("super_name", input.topicName);
  }
  if (input.topicUrl) {
    form.set("topic_url", input.topicUrl);
  }
  if (topicId) {
    form.set("topic_id", topicId);
    form.set("super_id", topicId);
    form.set("id", topicId);
  }

  const attemptPayloads = [
    {
      body: form.toString(),
      contentType: "application/x-www-form-urlencoded; charset=UTF-8",
      mode: "form" as const,
    },
    {
      body: JSON.stringify(Object.fromEntries(form.entries())),
      contentType: "application/json",
      mode: "json" as const,
    },
  ];

  const attempts: Array<{ endpoint: string; mode: string; ok: boolean; status: number; summary: unknown; businessOk?: boolean }> = [];

  if (topicId) {
    const legacyUrl = new URL("https://weibo.com/p/aj/general/button");
    legacyUrl.searchParams.set("ajwvr", "6");
    legacyUrl.searchParams.set("api", "http://i.huati.weibo.com/aj/super/checkin");
    legacyUrl.searchParams.set("texta", "已签到");
    legacyUrl.searchParams.set("textb", "已签到");
    legacyUrl.searchParams.set("status", "1");
    legacyUrl.searchParams.set("id", topicId);
    legacyUrl.searchParams.set("location", "page_100808_super_index");
    legacyUrl.searchParams.set("timezone", "GMT+0800");
    legacyUrl.searchParams.set("lang", "zh-cn");
    legacyUrl.searchParams.set("plat", getHostPlatform());
    legacyUrl.searchParams.set(
      "ua",
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36",
    );
    legacyUrl.searchParams.set("screen", "1920*1080");
    legacyUrl.searchParams.set("__rnd", String(now));

    const legacyResponse = await sendHttpRequestWithRetry(
      {
        url: legacyUrl.toString(),
        method: "GET",
        headers: {
          Cookie: cookie,
          Referer: input.topicUrl || "https://weibo.com/",
          Origin: "https://weibo.com",
          "X-Requested-With": "XMLHttpRequest",
        },
        timeoutMs: 12_000,
      },
      {
        retries: 1,
      },
    );

    const legacySummary = legacyResponse.json ?? legacyResponse.text.slice(0, 220);
    const legacyBusinessOk = tryExtractBusinessOk(legacySummary);
    attempts.push({
      endpoint: "https://weibo.com/p/aj/general/button",
      mode: "legacy-get",
      ok: legacyResponse.ok,
      status: legacyResponse.status,
      summary: legacySummary,
      businessOk: legacyBusinessOk,
    });

    if (legacyResponse.ok && legacyBusinessOk !== false && legacyResponse.json !== undefined) {
      return {
        ok: true,
        status: legacyResponse.status,
        summary: legacySummary,
        endpoint: "https://weibo.com/p/aj/general/button",
        mode: "legacy-get",
        businessOk: legacyBusinessOk,
        attempts,
      };
    }
  }

  for (const endpoint of endpoints) {
    for (const payload of attemptPayloads) {
      const headers: Record<string, string> = {
        Cookie: cookie,
        Referer: input.topicUrl || "https://weibo.com/",
        Origin: "https://weibo.com",
        "Content-Type": payload.contentType,
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
          body: payload.body,
          timeoutMs: 12_000,
        },
        {
          retries: 1,
        },
      );

      const summary = response.json ?? response.text.slice(0, 220);
      const businessOk = tryExtractBusinessOk(summary);
      attempts.push({ endpoint, mode: payload.mode, ok: response.ok, status: response.status, summary, businessOk });

      if (response.ok && businessOk !== false && response.json !== undefined) {
        return {
          ok: true,
          status: response.status,
          summary,
          endpoint,
          mode: payload.mode,
          businessOk,
          attempts,
        };
      }
    }
  }

  const latest = attempts[attempts.length - 1];

  return {
    ok: latest?.ok ?? false,
    status: latest?.status ?? 0,
    summary: latest?.summary ?? "签到请求未返回可用结果",
    endpoint: latest?.endpoint || endpoints[0],
    mode: latest?.mode || "form",
    businessOk: latest?.businessOk,
    attempts,
  };
}

async function sendLikeRequest(targetUrl: string, cookie: string) {
  const cookieMap = parseCookieMap(cookie);
  const xsrfToken = getXsrfToken(cookieMap);

  let resolvedTargetUrl = targetUrl;
  let statusId = normalizeStatusId(tryExtractStatusId(resolvedTargetUrl));

  if (!statusId) {
    resolvedTargetUrl = await resolveLikeTargetUrl(targetUrl, cookie);
    statusId = normalizeStatusId(tryExtractStatusId(resolvedTargetUrl));
  }

  if (!statusId) {
    return {
      ok: false,
      status: 0,
      summary: "目标链接中未识别到微博 ID",
      endpoint: "N/A",
      mode: "none",
      businessOk: false,
      resolvedTargetUrl,
      attempts: [] as Array<{ endpoint: string; mode: string; ok: boolean; status: number; summary: unknown; businessOk?: boolean }>,
    };
  }

  const endpoints = getLikeEndpoints();
  const attempts: Array<{ endpoint: string; mode: string; ok: boolean; status: number; summary: unknown; businessOk?: boolean }> = [];

  for (const endpoint of endpoints) {
    const form = new URLSearchParams();
    form.set("id", statusId);
    form.set("mid", statusId);
    form.set("object_id", statusId);
    form.set("target_id", statusId);
    form.set("attitude", "heart");
    form.set("location", "v6_content_home");

    const headers: Record<string, string> = {
      Cookie: cookie,
      Referer: resolvedTargetUrl,
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
        body: form.toString(),
        timeoutMs: 12_000,
      },
      {
        retries: 1,
      },
    );

    const summary = response.json ?? response.text.slice(0, 220);
    const businessOk = tryExtractBusinessOk(summary);
    const likeConfirmed = isLikeConfirmed(summary);
    attempts.push({ endpoint, mode: "form-post", ok: response.ok, status: response.status, summary, businessOk });

    if (response.ok && (businessOk === true || likeConfirmed)) {
      return {
        ok: true,
        status: response.status,
        summary,
        endpoint,
        mode: "form-post",
        businessOk,
        likeConfirmed,
        statusId,
        resolvedTargetUrl,
        attempts,
      };
    }
  }

  const latest = attempts[attempts.length - 1];

  return {
    ok: latest?.ok ?? false,
    status: latest?.status ?? 0,
    summary: latest?.summary ?? "点赞请求未返回可用结果",
    endpoint: latest?.endpoint || endpoints[0],
    mode: latest?.mode || "form-post",
    businessOk: latest?.businessOk,
    likeConfirmed: false,
    statusId,
    resolvedTargetUrl,
    attempts,
  };
}

async function sendCommentLikeRequest(targetUrl: string, cookie: string) {
  const objectId = tryExtractCommentId(targetUrl);

  if (!objectId) {
    return {
      ok: false,
      status: 0,
      summary: "评论直达链接中未识别到评论 ID",
      endpoint: getCommentLikeEndpoint(),
      mode: "app-form-post",
      businessOk: false,
      attempts: [] as Array<{ endpoint: string; mode: string; ok: boolean; status: number; summary: unknown; businessOk?: boolean }>,
    };
  }

  const cookieMap = parseCookieMap(cookie);
  const xsrfToken = getXsrfToken(cookieMap);

  if (!xsrfToken) {
    return {
      ok: false,
      status: 0,
      summary: "评论点赞缺少 XSRF-TOKEN，请重新录入账号 Cookie",
      endpoint: getCommentLikeEndpoint(),
      mode: "web-form-post",
      businessOk: false,
      objectId,
      attempts: [] as Array<{ endpoint: string; mode: string; ok: boolean; status: number; summary: unknown; businessOk?: boolean }>,
    };
  }

  const body = new URLSearchParams();
  body.set("object_id", objectId);
  body.set("object_type", "comment");

  const headers: Record<string, string> = {
    Accept: "application/json, text/plain, */*",
    "X-Requested-With": "XMLHttpRequest",
    "X-XSRF-TOKEN": xsrfToken,
    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    Cookie: cookie,
    Origin: "https://weibo.com",
    Referer: targetUrl.includes("weibo.com") ? targetUrl : "https://weibo.com/",
  };

  const response = await sendHttpRequestWithRetry(
    {
      url: getCommentLikeEndpoint(),
      method: "POST",
      headers,
      body: body.toString(),
      timeoutMs: 12_000,
    },
    {
      retries: 1,
    },
  );

  const summary = response.json ?? response.text.slice(0, 220);
  const businessOk = tryExtractBusinessOk(summary);

  return {
    ok: response.ok,
    status: response.status,
      summary,
      endpoint: getCommentLikeEndpoint(),
      mode: "web-form-post",
      businessOk,
      objectId,
    attempts: [{ endpoint: getCommentLikeEndpoint(), mode: "web-form-post", ok: response.ok, status: response.status, summary, businessOk }],
  };
}

async function sendRepostRequest(targetUrl: string, cookie: string, repostContent?: string | null) {
  const cookieMap = parseCookieMap(cookie);
  const xsrfToken = getXsrfToken(cookieMap);

  const resolvedTargetUrl = targetUrl;
  const statusId = normalizeStatusId(tryExtractStatusId(resolvedTargetUrl));

  if (!statusId) {
    return {
      ok: false,
      status: 0,
      summary: "目标链接中未识别到微博 ID，请使用目标微博详情页链接（weibo.com/{uid}/{bid}）",
      endpoint: "N/A",
      mode: "none",
      businessOk: false,
      resolvedTargetUrl,
      attempts: [] as Array<{ endpoint: string; mode: string; ok: boolean; status: number; summary: unknown; businessOk?: boolean }>,
    };
  }

  const beforeSnapshot = await fetchRepostCount(cookie, resolvedTargetUrl, statusId).catch(() => ({
    ok: false,
    repostsCount: undefined,
    summary: "repost-count-before-unavailable",
  }));

  const endpoints = getRepostEndpoints();
  const attempts: Array<{ endpoint: string; mode: string; ok: boolean; status: number; summary: unknown; businessOk?: boolean }> = [];

  for (const endpoint of endpoints) {
    const form = new URLSearchParams();
    const repostText = repostContent || "";
    if (endpoint.includes("/ajax/statuses/normal_repost")) {
      form.set("id", statusId);
      form.set("comment", repostText);
      form.set("pic_id", "");
      form.set("is_repost", "0");
      form.set("comment_ori", "0");
      form.set("is_comment", "0");
      form.set("visible", "0");
      form.set("share_id", "");
    } else {
      form.set("id", statusId);
      form.set("mid", statusId);
      form.set("content", repostText);
      form.set("text", repostText);
      form.set("status", repostText);
      form.set("is_comment", "0");
      form.set("location", "v6_content_home");
      form.set("module", "scommlist");
    }

    const headers: Record<string, string> = {
      Cookie: cookie,
      Referer: resolvedTargetUrl,
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
        body: form.toString(),
        timeoutMs: 12_000,
      },
      {
        retries: 1,
      },
    );

    const summary = response.json ?? response.text.slice(0, 220);
    const businessOk = tryExtractBusinessOk(summary);
    const repostConfirmed = isPostConfirmed(summary);
    attempts.push({ endpoint, mode: "form-post", ok: response.ok, status: response.status, summary, businessOk });

    if (response.ok && (businessOk === true || repostConfirmed)) {
      const afterSnapshot = await fetchRepostCount(cookie, resolvedTargetUrl, statusId).catch(() => ({
        ok: false,
        repostsCount: undefined,
        summary: "repost-count-after-unavailable",
      }));
      const countIncreased =
        beforeSnapshot.repostsCount !== undefined &&
        afterSnapshot.repostsCount !== undefined &&
        afterSnapshot.repostsCount > beforeSnapshot.repostsCount;

      if (beforeSnapshot.repostsCount !== undefined && afterSnapshot.repostsCount !== undefined && !countIncreased) {
        attempts.push({
          endpoint,
          mode: "repost-count-verify",
          ok: false,
          status: response.status,
          summary: {
            beforeRepostsCount: beforeSnapshot.repostsCount,
            afterRepostsCount: afterSnapshot.repostsCount,
            reason: "target_repost_count_not_increased",
          },
          businessOk: false,
        });
        continue;
      }

      return {
        ok: true,
        status: response.status,
        summary,
        endpoint,
        mode: "form-post",
        businessOk,
        statusId,
        resolvedTargetUrl,
        beforeRepostsCount: beforeSnapshot.repostsCount,
        afterRepostsCount: afterSnapshot.repostsCount,
        attempts,
      };
    }
  }

  const latest = attempts[attempts.length - 1];

  return {
    ok: latest?.ok ?? false,
    status: latest?.status ?? 0,
    summary: latest?.summary ?? "转发请求未返回可用结果",
    endpoint: latest?.endpoint || endpoints[0],
    mode: latest?.mode || "form-post",
    businessOk: latest?.businessOk,
    statusId,
    resolvedTargetUrl,
    attempts,
  };
}

async function sendPostRequest(content: string, topicName: string | undefined, topicUrl: string | undefined, cookie: string) {
  const cookieMap = parseCookieMap(cookie);
  const xsrfToken = getXsrfToken(cookieMap);
  const endpoints = getPostEndpoints();
  const text = topicName ? `${content}\n#${topicName}#` : content;

  const attempts: Array<{ endpoint: string; mode: string; ok: boolean; status: number; summary: unknown; businessOk?: boolean }> = [];

  const appAuthorization = process.env.WEIBO_APP_AUTHORIZATION;
  const appSessionId = process.env.WEIBO_APP_SESSION_ID;
  const appLogUid = process.env.WEIBO_APP_LOG_UID;
  const topicObjectId = toTopicObjectId(topicUrl);
  const topicRawId = toTopicRawId(topicUrl);
  const superTagId = extractSuperTagId(topicUrl);
  const shouldUseSuperPostOnly = Boolean(topicUrl && appAuthorization && topicObjectId && superTagId && topicRawId);

  if (appAuthorization && topicObjectId && superTagId && topicRawId) {
    const appBody = new URLSearchParams();
    const superTopicTag = topicName ? `#${topicName}[超话]#  ${content}` : content;
    const lfid = `${topicRawId}__${superTagId}_-_tag_comment_sort`;

    appBody.set("act", "add");
    appBody.set("callback_url", buildAppCallbackUrl(topicObjectId));
    appBody.set("content", superTopicTag);
    appBody.set("rcontent", superTopicTag);
    appBody.set("topic_id", topicObjectId);
    appBody.set("super_tag_id", superTagId);
    appBody.set("lfid", lfid);
    appBody.set("orifid", `profile_me$$${lfid}`);
    appBody.set("oriuicode", process.env.WEIBO_APP_ORI_UICODE || "10000011_10000011");
    appBody.set("extparam", `sg_user_type#2|super_tag_id=>${superTagId}`);
    appBody.set(
      "ext",
      process.env.WEIBO_APP_POST_EXT || "effectname:|network:wifi|sg_user_type#2|activity_picnum:0|content_change:1",
    );
    if (process.env.WEIBO_APP_FEATURECODE) {
      appBody.set("featurecode", process.env.WEIBO_APP_FEATURECODE);
    }
    appBody.set("moduleID", process.env.WEIBO_APP_MODULE_ID || "composer");
    appBody.set("luicode", process.env.WEIBO_APP_LUICODE || "10000011");
    appBody.set("uicode", process.env.WEIBO_APP_UICODE || "10000708");
    appBody.set("source_code", process.env.WEIBO_APP_SOURCE_CODE || "10000011_profile_me");
    appBody.set("source_text", "");
    appBody.set("phone_id", process.env.WEIBO_APP_PHONE_ID || "1399");
    appBody.set("is_vip_paid", "0");
    appBody.set("retry", "0");
    appBody.set("sync_mblog", "0");
    appBody.set("user_input", "1");
    appBody.set("check_id", String(Date.now()));
    appBody.set("client_mblogid", `OpenCode-${randomUUID()}`);

    const appHeaders: Record<string, string> = {
      Authorization: appAuthorization,
      "Content-Type": "application/x-www-form-urlencoded; charset=utf-8",
      "User-Agent": process.env.WEIBO_APP_USER_AGENT || "Weibo/99026 (iPhone; iOS 26.3.1; Scale/3.00)",
      Cookie: cookie,
      Referer: topicUrl || "https://weibo.com/",
      Origin: "https://api.weibo.cn",
      SNRT: process.env.WEIBO_APP_SNRT || "normal",
      "X-Engine-Type": process.env.WEIBO_APP_ENGINE_TYPE || "cronet-114.0.5735.246",
      cronet_rid: process.env.WEIBO_APP_CRONET_RID || String(Math.floor(Math.random() * 9_000_000) + 1_000_000),
    };

    if (appSessionId) {
      appHeaders["X-Sessionid"] = appSessionId;
    }

    if (appLogUid) {
      appHeaders["X-Log-Uid"] = appLogUid;
    }

    if (process.env.WEIBO_APP_SHANHAI_PASS) {
      appHeaders["X-Shanhai-Pass"] = process.env.WEIBO_APP_SHANHAI_PASS;
    }

    if (process.env.WEIBO_APP_VALIDATOR) {
      appHeaders["X-Validator"] = process.env.WEIBO_APP_VALIDATOR;
    }

    if (process.env.WEIBO_APP_ACCEPT_LANGUAGE) {
      appHeaders["Accept-Language"] = process.env.WEIBO_APP_ACCEPT_LANGUAGE;
    }

    const appResponse = await sendHttpRequestWithRetry(
      {
        url: getAppSendEndpoint(),
        method: "POST",
        headers: appHeaders,
        body: appBody.toString(),
        timeoutMs: 12_000,
      },
      {
        retries: 1,
      },
    );

    const appSummary = appResponse.json ?? appResponse.text.slice(0, 220);
    const appBusinessOk = tryExtractBusinessOk(appSummary);
    const postConfirmed = isPostConfirmed(appSummary);
    attempts.push({
      endpoint: "https://api.weibo.cn/2/statuses/send",
      mode: "app-form-post",
      ok: appResponse.ok,
      status: appResponse.status,
      summary: appSummary,
      businessOk: appBusinessOk,
    });

    if (appResponse.ok && (appBusinessOk === true || postConfirmed)) {
      return {
        ok: true,
        status: appResponse.status,
        summary: appSummary,
        endpoint: "https://api.weibo.cn/2/statuses/send",
        mode: "app-form-post",
        businessOk: appBusinessOk,
        attempts,
      };
    }
  }

  if (shouldUseSuperPostOnly) {
    const latest = attempts[attempts.length - 1];

    return {
      ok: false,
      status: latest?.status ?? 0,
      summary: latest?.summary ?? "超话发帖请求未通过",
      endpoint: "https://api.weibo.cn/2/statuses/send",
      mode: "app-form-post",
      businessOk: latest?.businessOk,
      attempts,
    };
  }

  for (const endpoint of endpoints) {
    const form = new URLSearchParams();
    form.set("text", text);
    form.set("visible", "0");
    form.set("_surl", "");
    form.set("pic_id", "");

    const headers: Record<string, string> = {
      Cookie: cookie,
      Referer: "https://weibo.com/",
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
        body: form.toString(),
        timeoutMs: 12_000,
      },
      {
        retries: 1,
      },
    );

    const summary = response.json ?? response.text.slice(0, 220);
    const businessOk = tryExtractBusinessOk(summary);
    const postConfirmed = isPostConfirmed(summary);
    attempts.push({ endpoint, mode: "form-post", ok: response.ok, status: response.status, summary, businessOk });

    if (response.ok && (businessOk === true || postConfirmed)) {
      return {
        ok: true,
        status: response.status,
        summary,
        endpoint,
        mode: "form-post",
        businessOk,
        attempts,
      };
    }
  }

  const latest = attempts[attempts.length - 1];

  return {
    ok: latest?.ok ?? false,
    status: latest?.status ?? 0,
    summary: latest?.summary ?? "发帖请求未返回可用结果",
    endpoint: latest?.endpoint || endpoints[0],
    mode: latest?.mode || "form-post",
    businessOk: latest?.businessOk,
    attempts,
  };
}

function tryExtractBusinessOk(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return undefined;
  }

  const record = payload as Record<string, unknown>;

  if (typeof record.errno === "number") {
    return record.errno === 0;
  }

  if (typeof record.ok === "number") {
    return record.ok === 1;
  }

  if (typeof record.ok === "boolean") {
    return record.ok;
  }

  if (typeof record.success === "boolean") {
    return record.success;
  }

  if (typeof record.code === "string") {
    return record.code === "100000" || record.code === "A00006";
  }

  if (typeof record.result === "number") {
    return record.result === 1;
  }

  if (typeof record.msg === "string") {
    if (record.msg.includes("已签到") || record.msg.includes("签到成功") || record.msg.includes("已赞") || record.msg.includes("点赞成功")) {
      return true;
    }
  }

  return undefined;
}

function isPostConfirmed(payload: unknown): boolean {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  const record = payload as Record<string, unknown>;

  if (typeof record.idstr === "string" && record.idstr.trim()) {
    return true;
  }

  if (typeof record.idStr === "string" && record.idStr.trim()) {
    return true;
  }

  if (typeof record.id === "string" && record.id.trim()) {
    return true;
  }

  if (typeof record.id === "number") {
    return true;
  }

  if (record.data && typeof record.data === "object") {
    return isPostConfirmed(record.data);
  }

  if (record.statuses && typeof record.statuses === "object") {
    return isPostConfirmed(record.statuses);
  }

  return false;
}

function isLikeConfirmed(payload: unknown): boolean {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  const record = payload as Record<string, unknown>;

  if (record.attitude === "heart" || record.attitude === "like") {
    return true;
  }

  if (typeof record.like === "boolean" && record.like) {
    return true;
  }

  if (typeof record.liked === "boolean" && record.liked) {
    return true;
  }

  if (typeof record.msg === "string") {
    if (record.msg.includes("已赞") || record.msg.includes("点赞成功") || record.msg.includes("赞过")) {
      return true;
    }
  }

  if (record.data && typeof record.data === "object") {
    return isLikeConfirmed(record.data);
  }

  return false;
}

function extractLikeResultId(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object") {
    return undefined;
  }

  const record = payload as Record<string, unknown>;

  if (typeof record.idStr === "string" && record.idStr.trim()) {
    return record.idStr;
  }

  if (typeof record.id === "string" && record.id.trim()) {
    return record.id;
  }

  if (typeof record.id === "number") {
    return String(record.id);
  }

  if (record.data && typeof record.data === "object") {
    return extractLikeResultId(record.data);
  }

  return undefined;
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

async function fetchRepostCount(cookie: string, referer: string, statusId: string) {
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
      timeoutMs: 10_000,
    },
    {
      retries: 1,
    },
  );

  const summary = response.json ?? response.text.slice(0, 220);
  const record = response.json as Record<string, unknown> | undefined;
  const repostsCount = toNumber(record?.reposts_count ?? record?.repostsCount);

  return {
    ok: response.ok,
    repostsCount,
    summary,
  };
}

async function verifyLikeState(cookie: string, referer: string, candidateIds: Array<string | undefined>) {
  const ids = Array.from(new Set(candidateIds.filter((id): id is string => Boolean(id && id.trim()))));

  const attempts: Array<{ endpoint: string; status: number; summary: unknown }> = [];

  for (const id of ids) {
    const endpoint = `https://weibo.com/ajax/statuses/show?id=${encodeURIComponent(id)}`;
    const response = await sendHttpRequestWithRetry(
      {
        url: endpoint,
        method: "GET",
        headers: {
          Cookie: cookie,
          Referer: referer || "https://weibo.com/",
          "X-Requested-With": "XMLHttpRequest",
        },
        timeoutMs: 10_000,
      },
      {
        retries: 1,
      },
    );

    const summary = response.json ?? response.text.slice(0, 220);
    attempts.push({ endpoint, status: response.status, summary });

    if (response.ok && isLikeConfirmed(summary)) {
      return {
        ok: true,
        confirmedId: id,
        summary,
        attempts,
      };
    }
  }

  return {
    ok: false,
    summary: attempts[attempts.length - 1]?.summary ?? "点赞回查未拿到可用数据",
    attempts,
  };
}

function successResult(message: string, status: ExecutorActionResult["status"], responsePayload?: unknown): ExecutorActionResult {
  return {
    success: true,
    status,
    stage: "ACTION_PENDING",
    message,
    responsePayload,
  };
}

export class WeiboExecutor implements SocialExecutor {
  async executePlan(input: ExecutePlanInput): Promise<ExecutorActionResult> {
    const blocked = validatePlanPrecheck(input, "weibo");

    if (blocked) {
      return blocked;
    }

    try {
      const account = await getAccountCookie(input.accountId);
      const probe = await buildConnectivityProbe(account.cookie);

      if (!probe.ok) {
        return blockedResult("微博连通性探测未通过，无法进入真实执行阶段。", {
          executor: "weibo",
          precheck: "blocked",
          reason: "CONNECTIVITY_PROBE_FAILED",
          planType: input.planType,
          topicName: input.topicName,
          targetUrl: input.targetUrl,
          loginStatus: account.loginStatus,
          probe,
        });
      }

      if (input.planType === "CHECK_IN") {
        const checkInResult = await sendCheckInRequest(input, account.cookie);
        const businessOk = tryExtractBusinessOk(checkInResult.summary);

        if (!checkInResult.ok || businessOk === false || businessOk === undefined) {
          return blockedResult("签到请求未通过，请检查账号 Cookie 或超话参数。", {
            executor: "weibo",
            precheck: "blocked",
            reason: "CHECK_IN_REQUEST_FAILED",
            summary: summarizePayload(checkInResult.summary),
            planType: input.planType,
            topicName: input.topicName,
            topicUrl: input.topicUrl,
            loginStatus: account.loginStatus,
            probe,
            checkInResult,
          });
        }

        return successResult(`已发起签到请求：${input.accountNickname} / ${input.topicName || "未命名超话"}`, "SUCCESS", {
          executor: "weibo",
          action: "CHECK_IN",
          summary: summarizePayload(checkInResult.summary),
          planType: input.planType,
          topicName: input.topicName,
          topicUrl: input.topicUrl,
          loginStatus: account.loginStatus,
          probe,
          checkInResult,
        });
      }

      if (input.planType === "POST" && input.content) {
        const postResult = await sendPostRequest(input.content, input.topicName ?? undefined, input.topicUrl ?? undefined, account.cookie);
        const businessOk = tryExtractBusinessOk(postResult.summary);

        if (!postResult.ok || businessOk === false) {
          return blockedResult("发帖请求未通过，请检查文案与账号登录态。", {
            executor: "weibo",
            precheck: "blocked",
            reason: "POST_REQUEST_FAILED",
            summary: summarizePayload(postResult.summary),
            planType: input.planType,
            topicName: input.topicName,
            loginStatus: account.loginStatus,
            probe,
            postResult,
          });
        }

        return successResult(`已发起发帖请求：${input.accountNickname}`, "SUCCESS", {
          executor: "weibo",
          action: "POST",
          summary: summarizePayload(postResult.summary),
          planType: input.planType,
          topicName: input.topicName,
          loginStatus: account.loginStatus,
          probe,
          postResult,
        });
      }

      if (input.planType === "LIKE" && input.targetUrl) {
        const likeResult = await sendLikeRequest(input.targetUrl, account.cookie);
        const businessOk = tryExtractBusinessOk(likeResult.summary);
        const likeConfirmed = isLikeConfirmed(likeResult.summary) || Boolean(likeResult.likeConfirmed);

        if (!likeResult.ok || businessOk === false || !likeConfirmed) {
          return blockedResult("点赞请求未通过，请检查目标链接和账号登录态。", {
            executor: "weibo",
            precheck: "blocked",
            reason: "LIKE_REQUEST_FAILED",
            summary: summarizePayload(likeResult.summary),
            planType: input.planType,
            targetUrl: input.targetUrl,
            loginStatus: account.loginStatus,
            probe,
            likeResult,
          });
        }

        const verifyResult = await verifyLikeState(account.cookie, input.targetUrl, [
          likeResult.statusId,
          extractLikeResultId(likeResult.summary),
        ]);

        return successResult(`已发起点赞请求：${input.accountNickname}`, "SUCCESS", {
          executor: "weibo",
          action: "LIKE",
          summary: summarizePayload(likeResult.summary),
          planType: input.planType,
          targetUrl: input.targetUrl,
          loginStatus: account.loginStatus,
          probe,
          likeResult,
          verifyResult,
          verifyWarning: verifyResult.ok ? undefined : "点赞请求已返回成功信号，但回查未确认，可能是微博回查接口限制导致。",
        });
      }

      return pendingActionResult(
        `weibo executor 骨架已就绪：账号 ${input.accountNickname} 的 ${input.planType} 计划通过了基础连通性探测，但尚未实现具体平台请求。`,
        {
          executor: "weibo",
          precheck: "passed",
          planType: input.planType,
          topicName: input.topicName,
          topicUrl: input.topicUrl,
          targetUrl: input.targetUrl,
          loginStatus: account.loginStatus,
          probe,
        },
      );
    } catch (error) {
      return blockedResult(error instanceof Error ? error.message : "执行计划失败");
    }
  }

  async executeInteraction(input: ExecuteInteractionInput): Promise<ExecutorActionResult> {
    const blocked = validateInteractionPrecheck(input, "weibo");

    if (blocked) {
      return blocked;
    }

    try {
      const account = await getAccountCookie(input.accountId);
      const probe = await buildConnectivityProbe(account.cookie);

      if (!probe.ok) {
        return blockedResult("微博连通性探测未通过，无法进入真实执行阶段。", {
          executor: "weibo",
          precheck: "blocked",
          reason: "CONNECTIVITY_PROBE_FAILED",
          actionType: input.actionType,
          targetUrl: input.targetUrl,
          loginStatus: account.loginStatus,
          probe,
        });
      }

      if (input.actionType === "LIKE") {
        const commentId = tryExtractCommentId(input.targetUrl);
        const commentMode = Boolean(commentId) || isCommentLikeLink(input.targetUrl);
        const likeResult = commentId
          ? await sendCommentLikeRequest(input.targetUrl, account.cookie)
          : commentMode
            ? await sendCommentLikeRequest(input.targetUrl, account.cookie)
            : await sendLikeRequest(input.targetUrl, account.cookie);
        const businessOk = tryExtractBusinessOk(likeResult.summary);
        const likeConfirmed = commentMode
          ? businessOk === true || isPostConfirmed(likeResult.summary)
          : isLikeConfirmed(likeResult.summary) || ("likeConfirmed" in likeResult && Boolean(likeResult.likeConfirmed));

        if (!likeResult.ok || businessOk === false || !likeConfirmed) {
          return blockedResult("点赞请求未通过，请检查目标链接和账号登录态。", {
            executor: "weibo",
            precheck: "blocked",
            reason: commentMode ? "COMMENT_LIKE_REQUEST_FAILED" : "LIKE_REQUEST_FAILED",
            summary: summarizePayload(likeResult.summary),
            actionType: input.actionType,
            targetUrl: input.targetUrl,
            loginStatus: account.loginStatus,
            probe,
            likeResult,
          });
        }

        const verifyResult = commentMode
          ? undefined
          : await verifyLikeState(account.cookie, input.targetUrl, [
              "statusId" in likeResult ? likeResult.statusId : undefined,
              extractLikeResultId(likeResult.summary),
            ]);

        return successResult(`已发起${commentMode ? "评论点赞" : "点赞"}请求：${input.accountNickname}`, "SUCCESS", {
          executor: "weibo",
          action: commentMode ? "COMMENT_LIKE" : "LIKE",
          summary: summarizePayload(likeResult.summary),
          actionType: input.actionType,
          targetUrl: input.targetUrl,
          loginStatus: account.loginStatus,
          probe,
          likeResult,
          verifyResult,
          verifyWarning:
            verifyResult && !verifyResult.ok
              ? "点赞请求已返回成功信号，但回查未确认，可能是微博回查接口限制导致。"
              : undefined,
        });
      }

      if (input.actionType === "POST") {
        const repostResult = await sendRepostRequest(input.targetUrl, account.cookie, input.repostContent);
        const businessOk = tryExtractBusinessOk(repostResult.summary);
        const repostConfirmed = isPostConfirmed(repostResult.summary);

        if (!repostResult.ok || businessOk === false || !repostConfirmed) {
          return blockedResult("转发请求未通过，请检查目标链接和账号登录态。", {
            executor: "weibo",
            precheck: "blocked",
            reason: "REPOST_REQUEST_FAILED",
            summary: summarizePayload(repostResult.summary),
            actionType: input.actionType,
            targetUrl: input.targetUrl,
            loginStatus: account.loginStatus,
            probe,
            repostResult,
          });
        }

        return successResult(`已发起转发请求：${input.accountNickname}`, "SUCCESS", {
          executor: "weibo",
          action: "REPOST",
          summary: summarizePayload(repostResult.summary),
          actionType: input.actionType,
          targetUrl: input.targetUrl,
          loginStatus: account.loginStatus,
          probe,
          repostResult,
        });
      }

      return pendingActionResult(
        `weibo executor 骨架已就绪：账号 ${input.accountNickname} 的 ${input.actionType} 互动任务通过了基础连通性探测，但尚未实现具体平台请求。`,
        {
          executor: "weibo",
          precheck: "passed",
          actionType: input.actionType,
          targetUrl: input.targetUrl,
          loginStatus: account.loginStatus,
          probe,
        },
      );
    } catch (error) {
      return blockedResult(error instanceof Error ? error.message : "执行互动任务失败");
    }
  }
}
