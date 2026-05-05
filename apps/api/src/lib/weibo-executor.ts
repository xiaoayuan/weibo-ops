import { randomUUID } from "node:crypto";

import { decryptText, getDecryptErrorMessage } from "@/src/lib/encrypt";
import { fetchStatusCommentsCount, sendStatusComment } from "@/src/lib/first-comment-plan";
import { sendHttpRequestWithRetry } from "@/src/lib/http-client";
import { validateInteractionPrecheck, validatePlanPrecheck } from "@/src/lib/executor-precheck";
import type { ExecuteInteractionInput, ExecutePlanInput, ExecutorActionResult, SocialExecutor } from "@/src/lib/executor-types";
import { prisma } from "@/src/lib/prisma";
import { getProxyExecutionCandidatesForAccount, type ProxyConfig } from "@/src/lib/proxy-config";

type CookieMap = Record<string, string>;
type TrafficSnapshot = { requestBytes: number; responseBytes: number; totalBytes: number };

type FailurePayload = {
  code: string;
  reason: string;
  responseSummary?: string;
  traffic?: TrafficSnapshot;
  [key: string]: unknown;
};

function parseCookieMap(cookie: string): CookieMap {
  return cookie
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce<CookieMap>((acc, item) => {
      const index = item.indexOf("=");
      if (index <= 0) return acc;
      const key = item.slice(0, index).trim();
      const value = item.slice(index + 1).trim();
      if (key) acc[key] = value;
      return acc;
    }, {});
}

function getXsrfToken(cookieMap: CookieMap) {
  for (const key of ["XSRF-TOKEN", "XSRF_TOKEN", "XSRFToken", "_xsrf", "xsrf"]) {
    if (cookieMap[key]) return decodeURIComponent(cookieMap[key]);
  }
  return undefined;
}

function blockedResult(message: string, responsePayload?: unknown): ExecutorActionResult {
  return { success: false, status: "FAILED", stage: "PRECHECK_BLOCKED", message, responsePayload };
}

function successResult(message: string, responsePayload?: unknown): ExecutorActionResult {
  return { success: true, status: "SUCCESS", stage: "ACTION_PENDING", message, responsePayload };
}

function readTrafficFromResponse(response: { requestBytes?: number; responseBytes?: number; totalBytes?: number }): TrafficSnapshot {
  const requestBytes = response.requestBytes ?? 0;
  const responseBytes = response.responseBytes ?? 0;
  const totalBytes = response.totalBytes ?? requestBytes + responseBytes;
  return { requestBytes, responseBytes, totalBytes };
}

function mergeTraffic(...items: Array<TrafficSnapshot | undefined>): TrafficSnapshot {
  return items.reduce<TrafficSnapshot>((acc, item) => {
    if (!item) return acc;
    acc.requestBytes += item.requestBytes;
    acc.responseBytes += item.responseBytes;
    acc.totalBytes += item.totalBytes;
    return acc;
  }, { requestBytes: 0, responseBytes: 0, totalBytes: 0 });
}

function summarizePayload(payload: unknown) {
  if (typeof payload === "string") return payload.slice(0, 220);
  try {
    return JSON.stringify(payload).slice(0, 220);
  } catch {
    return String(payload);
  }
}

function withFailurePayload(input: FailurePayload): FailurePayload {
  return {
    ...input,
    responseSummary: input.responseSummary || summarizePayload(input.raw ?? input.summary ?? null),
  };
}

function tryExtractBusinessOk(payload: unknown) {
  if (!payload || typeof payload !== "object") return undefined;
  const record = payload as Record<string, unknown>;
  if (typeof record.errno === "number") return record.errno === 0;
  if (typeof record.ok === "number") return record.ok === 1;
  if (typeof record.ok === "boolean") return record.ok;
  if (typeof record.success === "boolean") return record.success;
  if (typeof record.code === "string") return record.code === "100000" || record.code === "A00006";
  if (typeof record.result === "number") return record.result === 1;
  if (typeof record.msg === "string" && (record.msg.includes("已签到") || record.msg.includes("签到成功") || record.msg.includes("已赞") || record.msg.includes("点赞成功"))) {
    return true;
  }
  return undefined;
}

function isLikeConfirmed(payload: unknown): boolean {
  if (!payload || typeof payload !== "object") return false;
  const record = payload as Record<string, unknown>;
  if (record.attitude === "heart" || record.attitude === "like") return true;
  if (typeof record.like === "boolean" && record.like) return true;
  if (typeof record.liked === "boolean" && record.liked) return true;
  if (typeof record.msg === "string" && (record.msg.includes("已赞") || record.msg.includes("点赞成功") || record.msg.includes("赞过"))) return true;
  if (record.data && typeof record.data === "object") return isLikeConfirmed(record.data);
  return false;
}

function extractLikeResultId(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  const record = payload as Record<string, unknown>;
  if (typeof record.idStr === "string" && record.idStr.trim()) return record.idStr;
  if (typeof record.id === "string" && record.id.trim()) return record.id;
  if (typeof record.id === "number") return String(record.id);
  if (record.data && typeof record.data === "object") return extractLikeResultId(record.data);
  return undefined;
}

function extractPostResultId(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  const record = payload as Record<string, unknown>;
  if (typeof record.idstr === "string" && record.idstr.trim()) return record.idstr;
  if (typeof record.idStr === "string" && record.idStr.trim()) return record.idStr;
  if (typeof record.id === "string" && record.id.trim()) return record.id;
  if (typeof record.id === "number") return String(record.id);
  if (record.data && typeof record.data === "object") return extractPostResultId(record.data);
  if (record.statuses && typeof record.statuses === "object") return extractPostResultId(record.statuses);
  return undefined;
}

function isPostConfirmed(payload: unknown): boolean {
  if (!payload || typeof payload !== "object") return false;
  const record = payload as Record<string, unknown>;
  if (typeof record.idstr === "string" && record.idstr.trim()) return true;
  if (typeof record.idStr === "string" && record.idStr.trim()) return true;
  if (typeof record.id === "string" && record.id.trim()) return true;
  if (typeof record.id === "number") return true;
  if (record.data && typeof record.data === "object") return isPostConfirmed(record.data);
  if (record.statuses && typeof record.statuses === "object") return isPostConfirmed(record.statuses);
  return false;
}

function toNumber(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function _tryExtractUidFromStatusUrl(targetUrl?: string | null) {
  if (!targetUrl) return undefined;
  const candidates: string[] = [targetUrl.trim()];
  let decoded = targetUrl;
  for (let i = 0; i < 2; i += 1) {
    try {
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
      candidates.push(decoded);
    } catch {
      break;
    }
  }

  for (const candidate of candidates) {
    const matched = candidate.match(/weibo\.com\/(\d{5,20})\/[0-9a-zA-Z]{6,20}/i);
    if (matched?.[1]) return matched[1];
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

function extractSuperTagId(topicUrl?: string | null) {
  if (!topicUrl) return process.env.WEIBO_DEFAULT_SUPER_TAG_ID;
  const patterns = [/__(\d+)_-_tag_comment_sort/i, /[?&]super_tag_id=(\d+)/i];
  for (const pattern of patterns) {
    const matched = topicUrl.match(pattern);
    if (matched?.[1]) return matched[1];
  }
  return process.env.WEIBO_DEFAULT_SUPER_TAG_ID;
}

function tryExtractTopicId(topicUrl?: string | null) {
  if (!topicUrl) return undefined;
  const patterns = [/containerid=([a-zA-Z0-9]{6,})/i, /topicid=([a-zA-Z0-9]{6,})/i, /super(?:_index)?\/([a-zA-Z0-9]{6,})/i, /\/p\/([a-zA-Z0-9]{10,})\//i];
  for (const pattern of patterns) {
    const matched = topicUrl.match(pattern);
    if (matched?.[1]) return matched[1];
  }
  return undefined;
}

function toTopicObjectId(topicUrl?: string | null) {
  const raw = tryExtractTopicId(topicUrl);
  if (!raw) return undefined;
  return raw.includes(":") ? raw : `1022:${raw}`;
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
  if (gsid) query.set("gsid", gsid);
  const url = new URL(endpoint);
  query.forEach((value, key) => url.searchParams.set(key, value));
  return url.toString();
}

function buildAppCallbackUrl(topicObjectId: string) {
  if (process.env.WEIBO_APP_CALLBACK_URL) return process.env.WEIBO_APP_CALLBACK_URL;
  const url = new URL("http://i.huati.weibo.com/super/autoattention/supertopic");
  url.searchParams.set("object_id", topicObjectId);
  return url.toString();
}

function tryExtractStatusId(targetUrl?: string | null) {
  if (!targetUrl) return undefined;
  const candidates: string[] = [targetUrl.trim()];
  let decoded = targetUrl;
  for (let i = 0; i < 3; i += 1) {
    try {
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
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
      if (matched?.[1]) return matched[1];
    }
    const longDigits = candidate.match(/(\d{15,20})/g);
    if (longDigits?.length) return longDigits[0];
  }
  return undefined;
}

function tryExtractCommentId(targetUrl?: string | null) {
  if (!targetUrl) return undefined;

  const candidates: string[] = [targetUrl];
  let decoded = targetUrl;
  for (let i = 0; i < 3; i += 1) {
    try {
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
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
      if (matched?.[1]) return matched[1];
    }

    const commentContext =
      candidate.toLowerCase().includes("weibo.cn/comment/") ||
      candidate.toLowerCase().includes("rid=") ||
      candidate.toLowerCase().includes("object_id=") ||
      candidate.toLowerCase().includes("comment/");

    if (commentContext) {
      const longDigits = candidate.match(/(\d{15,20})/g);
      if (longDigits?.length) return longDigits[0];
    }
  }

  return undefined;
}

function isCommentLikeLink(targetUrl: string) {
  const text = targetUrl.toLowerCase();
  return text.includes("weibo.cn/comment/") || text.includes("rid=") || text.includes("object_id=") || text.includes("service.account.weibo.com/reportspam");
}

async function getAccountCookie(accountId: string) {
  const account = await prisma.weiboAccount.findUnique({
    where: { id: accountId },
    select: { id: true, nickname: true, cookieEncrypted: true, loginStatus: true },
  });

  if (!account) throw new Error("账号不存在");
  if (!account.cookieEncrypted) throw new Error("账号尚未录入 Cookie");

  try {
    return { ...account, cookie: decryptText(account.cookieEncrypted) };
  } catch (error) {
    throw new Error(getDecryptErrorMessage(error));
  }
}

async function buildConnectivityProbe(cookie: string, proxyConfig?: ProxyConfig | null) {
  const response = await sendHttpRequestWithRetry({
    url: "https://weibo.com/",
    headers: { Cookie: cookie, Referer: "https://weibo.com/" },
    timeoutMs: 10_000,
    proxyConfig,
  }, { retries: 1 });

  return {
    ok: response.ok,
    status: response.status,
    summary: response.json ?? response.text.slice(0, 200),
    traffic: readTrafficFromResponse(response),
  };
}

async function resolveExecutionProxy(accountId: string, cookie: string) {
  const candidates = await getProxyExecutionCandidatesForAccount(accountId);
  const attempts: Array<{ label: string; ok: boolean; status?: number; message?: string }> = [];

  for (const candidate of candidates) {
    try {
      const probe = await buildConnectivityProbe(cookie, candidate.proxyConfig);
      attempts.push({ label: candidate.label, ok: probe.ok, status: probe.status });
      if (probe.ok) {
        return { selected: candidate, probe, attempts };
      }
    } catch (error) {
      attempts.push({ label: candidate.label, ok: false, message: error instanceof Error ? error.message : "连通性测试失败" });
    }
  }

  return { selected: null, probe: null, attempts };
}

async function sendCheckInRequest(input: ExecutePlanInput, cookie: string, proxyConfig?: ProxyConfig | null) {
  const cookieMap = parseCookieMap(cookie);
  const xsrfToken = getXsrfToken(cookieMap);
  const endpoint = process.env.WEIBO_CHECKIN_ENDPOINT || "https://weibo.com/ajax/super/checkin";
  const form = new URLSearchParams();
  form.set("name", input.topicName);
  form.set("super_name", input.topicName);
  form.set("topic_url", input.topicUrl);

  const headers: Record<string, string> = {
    Cookie: cookie,
    Referer: input.topicUrl || "https://weibo.com/",
    Origin: "https://weibo.com",
    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    "X-Requested-With": "XMLHttpRequest",
  };
  if (xsrfToken) headers["X-XSRF-TOKEN"] = xsrfToken;

  const response = await sendHttpRequestWithRetry({
    url: endpoint,
    method: "POST",
    headers,
    body: form.toString(),
    timeoutMs: 12_000,
    proxyConfig,
  }, { retries: 1 });

  return { ok: response.ok, status: response.status, summary: response.json ?? response.text.slice(0, 220), traffic: readTrafficFromResponse(response) };
}

async function sendLikeRequest(targetUrl: string, cookie: string, proxyConfig?: ProxyConfig | null) {
  const statusId = normalizeStatusId(tryExtractStatusId(targetUrl));
  if (!statusId) {
    return { ok: false, status: 0, summary: "目标链接中未识别到微博 ID", traffic: mergeTraffic() };
  }

  const cookieMap = parseCookieMap(cookie);
  const xsrfToken = getXsrfToken(cookieMap);
  const endpoint = process.env.WEIBO_LIKE_ENDPOINT || "https://weibo.com/ajax/statuses/setLike";
  const form = new URLSearchParams();
  form.set("id", statusId);
  form.set("mid", statusId);
  form.set("attitude", "heart");

  const headers: Record<string, string> = {
    Cookie: cookie,
    Referer: targetUrl,
    Origin: "https://weibo.com",
    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    "X-Requested-With": "XMLHttpRequest",
  };
  if (xsrfToken) headers["X-XSRF-TOKEN"] = xsrfToken;

  const response = await sendHttpRequestWithRetry({ url: endpoint, method: "POST", headers, body: form.toString(), timeoutMs: 12_000, proxyConfig }, { retries: 1 });
  return { ok: response.ok, status: response.status, summary: response.json ?? response.text.slice(0, 220), statusId, traffic: readTrafficFromResponse(response) };
}

async function sendCommentLikeRequest(targetUrl: string, cookie: string, proxyConfig?: ProxyConfig | null) {
  const objectId = tryExtractCommentId(targetUrl);
  if (!objectId) {
    return { ok: false, status: 0, summary: "评论直达链接中未识别到评论 ID", objectId: undefined, traffic: mergeTraffic() };
  }

  const cookieMap = parseCookieMap(cookie);
  const xsrfToken = getXsrfToken(cookieMap);
  if (!xsrfToken) {
    return { ok: false, status: 0, summary: "评论点赞缺少 XSRF-TOKEN，请重新录入账号 Cookie", objectId, traffic: mergeTraffic() };
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

  const endpoint = process.env.WEIBO_WEB_COMMENT_LIKE_ENDPOINT || "https://weibo.com/ajax/statuses/updateLike";
  const response = await sendHttpRequestWithRetry({ url: endpoint, method: "POST", headers, body: body.toString(), timeoutMs: 12_000, proxyConfig }, { retries: 1 });
  return { ok: response.ok, status: response.status, summary: response.json ?? response.text.slice(0, 220), objectId, traffic: readTrafficFromResponse(response) };
}

async function sendRepostRequest(targetUrl: string, cookie: string, repostContent?: string | null, proxyConfig?: ProxyConfig | null) {
  const resolvedTargetUrl = targetUrl;
  const statusId = normalizeStatusId(tryExtractStatusId(resolvedTargetUrl));
  if (!statusId) {
    return { ok: false, status: 0, summary: "目标链接中未识别到微博 ID", traffic: mergeTraffic() };
  }

  const cookieMap = parseCookieMap(cookie);
  const xsrfToken = getXsrfToken(cookieMap);
  const endpoint = process.env.WEIBO_REPOST_ENDPOINT || "https://weibo.com/ajax/statuses/repost";
  const beforeSnapshot = await fetchRepostCount(cookie, resolvedTargetUrl, statusId, proxyConfig).catch(() => ({
    ok: false,
    repostsCount: undefined,
    isRepost: false,
    originStatusId: undefined,
    summary: "repost-count-before-unavailable",
    traffic: mergeTraffic(),
  }));
  const requireStrictTargetIncrease = beforeSnapshot.isRepost;
  const originBeforeSnapshot = beforeSnapshot.originStatusId
    ? await fetchRepostCount(cookie, resolvedTargetUrl, beforeSnapshot.originStatusId, proxyConfig).catch(() => ({
        ok: false,
        repostsCount: undefined,
        isRepost: false,
        originStatusId: undefined,
        summary: "origin-repost-count-before-unavailable",
        traffic: mergeTraffic(),
      }))
    : undefined;
  const form = new URLSearchParams();
  form.set("id", statusId);
  form.set("mid", statusId);
  form.set("content", repostContent || "");
  form.set("comment", repostContent || "");

  const headers: Record<string, string> = {
    Cookie: cookie,
    Referer: targetUrl,
    Origin: "https://weibo.com",
    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    "X-Requested-With": "XMLHttpRequest",
  };
  if (xsrfToken) headers["X-XSRF-TOKEN"] = xsrfToken;

  const response = await sendHttpRequestWithRetry({ url: endpoint, method: "POST", headers, body: form.toString(), timeoutMs: 12_000, proxyConfig }, { retries: 1 });
  const summary = response.json ?? response.text.slice(0, 220);
  const afterSnapshot = await fetchRepostCount(cookie, resolvedTargetUrl, statusId, proxyConfig).catch(() => ({
    ok: false,
    repostsCount: undefined,
    isRepost: false,
    originStatusId: undefined,
    summary: "repost-count-after-unavailable",
    traffic: mergeTraffic(),
  }));
  const originAfterSnapshot = beforeSnapshot.originStatusId
    ? await fetchRepostCount(cookie, resolvedTargetUrl, beforeSnapshot.originStatusId, proxyConfig).catch(() => ({
        ok: false,
        repostsCount: undefined,
        isRepost: false,
        originStatusId: undefined,
        summary: "origin-repost-count-after-unavailable",
        traffic: mergeTraffic(),
      }))
    : undefined;
  const countIncreased =
    beforeSnapshot.repostsCount !== undefined &&
    afterSnapshot.repostsCount !== undefined &&
    afterSnapshot.repostsCount > beforeSnapshot.repostsCount;

  return {
    ok:
      response.ok &&
      !(requireStrictTargetIncrease && (beforeSnapshot.repostsCount === undefined || afterSnapshot.repostsCount === undefined)) &&
      !(requireStrictTargetIncrease && !countIncreased) &&
      !(beforeSnapshot.repostsCount !== undefined && afterSnapshot.repostsCount !== undefined && !countIncreased),
    status: response.status,
    summary,
    beforeRepostsCount: beforeSnapshot.repostsCount,
    afterRepostsCount: afterSnapshot.repostsCount,
    originStatusId: beforeSnapshot.originStatusId,
    originBeforeRepostsCount: originBeforeSnapshot?.repostsCount,
    originAfterRepostsCount: originAfterSnapshot?.repostsCount,
    traffic: mergeTraffic(readTrafficFromResponse(response), beforeSnapshot.traffic, afterSnapshot.traffic, originBeforeSnapshot?.traffic, originAfterSnapshot?.traffic),
  };
}

async function fetchRepostCount(cookie: string, referer: string, statusId: string, proxyConfig?: ProxyConfig | null) {
  const endpoint = `https://weibo.com/ajax/statuses/show?id=${encodeURIComponent(statusId)}`;
  const response = await sendHttpRequestWithRetry({
    url: endpoint,
    method: "GET",
    headers: {
      Cookie: cookie,
      Referer: referer || "https://weibo.com/",
      "X-Requested-With": "XMLHttpRequest",
    },
    timeoutMs: 10_000,
    proxyConfig,
  }, { retries: 1 });

  const summary = response.json ?? response.text.slice(0, 220);
  const record = response.json as Record<string, unknown> | undefined;
  const repostsCount = toNumber(record?.reposts_count ?? record?.repostsCount);
  const isRepost = Boolean(record?.retweeted_status && typeof record.retweeted_status === "object");

  return {
    ok: response.ok,
    repostsCount,
    isRepost,
    originStatusId:
      typeof (record?.retweeted_status as Record<string, unknown> | undefined)?.idstr === "string"
        ? String((record?.retweeted_status as Record<string, unknown>).idstr)
        : typeof (record?.retweeted_status as Record<string, unknown> | undefined)?.id === "number"
          ? String((record?.retweeted_status as Record<string, unknown>).id)
          : undefined,
    summary,
    traffic: readTrafficFromResponse(response),
  };
}

async function sendPostRequest(content: string, topicName: string | undefined, topicUrl: string | undefined, _postingUrl: string | undefined, cookie: string, proxyConfig?: ProxyConfig | null) {
  const cookieMap = parseCookieMap(cookie);
  const xsrfToken = getXsrfToken(cookieMap);
  const effectiveUrl = topicUrl || "";
  const endpoints = [process.env.WEIBO_POST_ENDPOINT || "https://weibo.com/ajax/statuses/update"];
  const text = topicName ? `${content}\n#${topicName}#` : content;
  const attempts: Array<{ endpoint: string; mode: string; ok: boolean; status: number; summary: unknown; businessOk?: boolean }> = [];
  let traffic = mergeTraffic();

  const appAuthorization = process.env.WEIBO_APP_AUTHORIZATION;
  const appSessionId = process.env.WEIBO_APP_SESSION_ID;
  const appLogUid = process.env.WEIBO_APP_LOG_UID;
  const topicObjectId = toTopicObjectId(effectiveUrl);
  const topicRawId = toTopicRawId(effectiveUrl);
  const superTagId = extractSuperTagId(effectiveUrl);
  const shouldUseSuperPostOnly = Boolean(effectiveUrl && appAuthorization && topicObjectId && superTagId && topicRawId);

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
    appBody.set("ext", process.env.WEIBO_APP_POST_EXT || "effectname:|network:wifi|sg_user_type#2|activity_picnum:0|content_change:1");
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
    if (appSessionId) appHeaders["X-Sessionid"] = appSessionId;
    if (appLogUid) appHeaders["X-Log-Uid"] = appLogUid;
    if (process.env.WEIBO_APP_SHANHAI_PASS) appHeaders["X-Shanhai-Pass"] = process.env.WEIBO_APP_SHANHAI_PASS;
    if (process.env.WEIBO_APP_VALIDATOR) appHeaders["X-Validator"] = process.env.WEIBO_APP_VALIDATOR;
    if (process.env.WEIBO_APP_ACCEPT_LANGUAGE) appHeaders["Accept-Language"] = process.env.WEIBO_APP_ACCEPT_LANGUAGE;

    const appResponse = await sendHttpRequestWithRetry({ url: getAppSendEndpoint(), method: "POST", headers: appHeaders, body: appBody.toString(), timeoutMs: 12_000, proxyConfig }, { retries: 1 });
    const appSummary = appResponse.json ?? appResponse.text.slice(0, 220);
    traffic = mergeTraffic(traffic, readTrafficFromResponse(appResponse));
    const appBusinessOk = tryExtractBusinessOk(appSummary);
    const postConfirmed = isPostConfirmed(appSummary);
    attempts.push({ endpoint: "https://api.weibo.cn/2/statuses/send", mode: "app-form-post", ok: appResponse.ok, status: appResponse.status, summary: appSummary, businessOk: appBusinessOk });
    if (appResponse.ok && (appBusinessOk === true || postConfirmed)) {
      return { ok: true, status: appResponse.status, summary: appSummary, attempts, traffic };
    }
  }

  if (shouldUseSuperPostOnly) {
    const latest = attempts[attempts.length - 1];
    return { ok: false, status: latest?.status ?? 0, summary: latest?.summary ?? "超话发帖请求未通过", attempts, traffic };
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
    if (xsrfToken) headers["X-XSRF-TOKEN"] = xsrfToken;

    const response = await sendHttpRequestWithRetry({ url: endpoint, method: "POST", headers, body: form.toString(), timeoutMs: 12_000, proxyConfig }, { retries: 1 });
    const summary = response.json ?? response.text.slice(0, 220);
    traffic = mergeTraffic(traffic, readTrafficFromResponse(response));
    const businessOk = tryExtractBusinessOk(summary);
    const postConfirmed = isPostConfirmed(summary);
    attempts.push({ endpoint, mode: "form-post", ok: response.ok, status: response.status, summary, businessOk });

    if (response.ok && (businessOk === true || postConfirmed)) {
      return { ok: true, status: response.status, summary, attempts, traffic };
    }
  }

  const latest = attempts[attempts.length - 1];
  return { ok: latest?.ok ?? false, status: latest?.status ?? 0, summary: latest?.summary ?? "发帖请求未返回可用结果", attempts, traffic };
}

async function warmupInteractionTarget(targetUrl: string, cookie: string, proxyConfig?: ProxyConfig | null) {
  try {
    const response = await sendHttpRequestWithRetry({
      url: targetUrl,
      method: "GET",
      headers: {
        Cookie: cookie,
        Referer: "https://weibo.com/",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      timeoutMs: 10_000,
      proxyConfig,
    }, { retries: 1 });

    return { ok: response.ok, status: response.status, traffic: readTrafficFromResponse(response), finalUrl: response.finalUrl };
  } catch {
    return { ok: false, status: 0, traffic: mergeTraffic(), finalUrl: targetUrl };
  }
}

async function verifyLikeState(cookie: string, referer: string, candidateIds: Array<string | undefined>, proxyConfig?: ProxyConfig | null) {
  const ids = Array.from(new Set(candidateIds.filter((id): id is string => Boolean(id && id.trim()))));
  const attempts: Array<{ endpoint: string; status: number; summary: unknown }> = [];
  let traffic = mergeTraffic();

  for (const id of ids) {
    const endpoint = `https://weibo.com/ajax/statuses/show?id=${encodeURIComponent(id)}`;
    const response = await sendHttpRequestWithRetry({
      url: endpoint,
      method: "GET",
      headers: { Cookie: cookie, Referer: referer || "https://weibo.com/", "X-Requested-With": "XMLHttpRequest" },
      timeoutMs: 10_000,
      proxyConfig,
    }, { retries: 1 });

    const summary = response.json ?? response.text.slice(0, 220);
    traffic = mergeTraffic(traffic, readTrafficFromResponse(response));
    attempts.push({ endpoint, status: response.status, summary });

    if (response.ok && isLikeConfirmed(summary)) {
      return { ok: true, confirmedId: id, summary, attempts, traffic };
    }
  }

  return { ok: false, summary: attempts[attempts.length - 1]?.summary ?? "点赞回查未拿到可用数据", attempts, traffic };
}

async function verifyPostState(cookie: string, referer: string, candidateIds: Array<string | undefined>, proxyConfig?: ProxyConfig | null) {
  const ids = Array.from(new Set(candidateIds.map((id) => normalizeStatusId(id)).filter((id): id is string => Boolean(id && id.trim()))));
  const attempts: Array<{ endpoint: string; status: number; summary: unknown }> = [];
  let traffic = mergeTraffic();

  for (const id of ids) {
    const endpoint = `https://weibo.com/ajax/statuses/show?id=${encodeURIComponent(id)}`;
    const response = await sendHttpRequestWithRetry({
      url: endpoint,
      method: "GET",
      headers: { Cookie: cookie, Referer: referer || "https://weibo.com/", "X-Requested-With": "XMLHttpRequest" },
      timeoutMs: 10_000,
      proxyConfig,
    }, { retries: 1 });

    const summary = response.json ?? response.text.slice(0, 220);
    traffic = mergeTraffic(traffic, readTrafficFromResponse(response));
    attempts.push({ endpoint, status: response.status, summary });

    if (response.ok && isPostConfirmed(summary)) {
      return { ok: true, confirmedId: id, summary, attempts, traffic };
    }
  }

  return { ok: false, summary: attempts[attempts.length - 1]?.summary ?? "发帖回查未拿到可用数据", attempts, traffic };
}

function getLikeFailureMessage(input: { targetUrl: string; summary: unknown; commentMode: boolean; loginStatus: string }) {
  const summaryText = summarizePayload(input.summary).toLowerCase();

  if (summaryText.includes("已赞") || summaryText.includes("already") || summaryText.includes("repeat like")) return "该目标可能已经点过赞，重复点赞未通过。";
  if (summaryText.includes("visitor") || summaryText.includes("sina visitor") || summaryText.includes("passport")) return "当前请求被微博游客系统拦截，请检查代理/IP 质量。";
  if (summaryText.includes("xsrf") || summaryText.includes("token")) return "点赞请求缺少必要校验参数，请重新登录该账号。";
  if (summaryText.includes("评论") && summaryText.includes("不存在")) return "目标评论不可见、已删除或评论 ID 无效。";
  if (summaryText.includes("目标链接中未识别到微博 id") || summaryText.includes("评论直达链接中未识别到评论 id")) {
    return input.commentMode ? "评论链接格式不正确，无法识别评论 ID。" : "微博链接格式不正确，无法识别微博 ID。";
  }
  if (input.loginStatus !== "ONLINE") return "账号当前登录态异常，点赞请求未通过。";
  return input.commentMode ? "评论点赞请求未通过，请检查评论链接、账号状态或是否已点赞。" : "点赞请求未通过，请检查目标链接和账号登录态。";
}

export class WeiboExecutor implements SocialExecutor {
  async executePlan(input: ExecutePlanInput): Promise<ExecutorActionResult> {
    const blocked = validatePlanPrecheck(input, "weibo");
    if (blocked) return blocked;

    try {
      const account = await getAccountCookie(input.accountId);
      const resolvedProxy = await resolveExecutionProxy(input.accountId, account.cookie);
      if (!resolvedProxy.selected || !resolvedProxy.probe?.ok) {
          return blockedResult("微博连通性探测未通过，无法进入真实执行阶段。", withFailurePayload({
            executor: "weibo",
            code: "CONNECTIVITY_PROBE_FAILED",
            reason: "CONNECTIVITY_PROBE_FAILED",
            proxyAttempts: resolvedProxy.attempts,
          }));
        }

      const proxyConfig = resolvedProxy.selected.proxyConfig;
      const probe = resolvedProxy.probe;

      if (input.planType === "CHECK_IN") {
        const result = await sendCheckInRequest(input, account.cookie, proxyConfig);
        const businessOk = tryExtractBusinessOk(result.summary);
        if (!result.ok || businessOk === false || businessOk === undefined) {
          return blockedResult("签到请求未通过，请检查账号 Cookie 或超话参数。", withFailurePayload({ code: "CHECK_IN_REQUEST_FAILED", reason: "CHECK_IN_REQUEST_FAILED", raw: result.summary, traffic: mergeTraffic(probe.traffic, result.traffic), probe, result }));
        }
        return successResult(`已发起签到请求：${input.accountNickname} / ${input.topicName || "未命名超话"}`, { probe, result, traffic: mergeTraffic(probe.traffic, result.traffic) });
      }

      if (input.planType === "POST" && input.content) {
        const result = await sendPostRequest(input.content, input.topicName ?? undefined, input.topicUrl ?? undefined, input.postingUrl, account.cookie, proxyConfig);
        const businessOk = tryExtractBusinessOk(result.summary);
        if (!result.ok || businessOk === false || !isPostConfirmed(result.summary)) {
          return blockedResult("发帖请求未通过，请检查文案与账号登录态。", withFailurePayload({ code: "POST_REQUEST_FAILED", reason: "POST_REQUEST_FAILED", raw: result.summary, traffic: mergeTraffic(probe.traffic, result.traffic), probe, result }));
        }

        const verifyResult = await verifyPostState(account.cookie, input.topicUrl || "https://weibo.com/", [extractPostResultId(result.summary)], proxyConfig);
        return successResult(`已发起发帖请求：${input.accountNickname}`, { probe, result, verifyResult, verifyWarning: verifyResult.ok ? undefined : "发帖请求已返回成功信号，但回查未确认，可能是微博回查接口限制导致。", traffic: mergeTraffic(probe.traffic, result.traffic, verifyResult.traffic) });
      }

      if (input.planType === "LIKE" && input.targetUrl) {
        const result = await sendLikeRequest(input.targetUrl, account.cookie, proxyConfig);
        const businessOk = tryExtractBusinessOk(result.summary);
        if (!result.ok || businessOk === false || !isLikeConfirmed(result.summary)) {
          return blockedResult("点赞请求未通过，请检查目标链接和账号登录态。", withFailurePayload({ code: "LIKE_REQUEST_FAILED", reason: "LIKE_REQUEST_FAILED", raw: result.summary, traffic: mergeTraffic(probe.traffic, result.traffic), probe, result }));
        }

        const verifyResult = await verifyLikeState(account.cookie, input.targetUrl, [result.statusId, extractLikeResultId(result.summary)], proxyConfig);
        return successResult(`已发起点赞请求：${input.accountNickname}`, { probe, result, verifyResult, verifyWarning: verifyResult.ok ? undefined : "点赞请求已返回成功信号，但回查未确认，可能是微博回查接口限制导致。", traffic: mergeTraffic(probe.traffic, result.traffic, verifyResult.traffic) });
      }

    if (input.planType === "REPOST" && input.targetUrl) {
        const result = await sendRepostRequest(input.targetUrl, account.cookie, input.content || null, proxyConfig);
        const businessOk = tryExtractBusinessOk(result.summary);
        if (!result.ok || businessOk === false || !isPostConfirmed(result.summary)) {
          return blockedResult("转发请求未通过，请检查目标链接和账号登录态。", withFailurePayload({ code: "REPOST_REQUEST_FAILED", reason: "REPOST_REQUEST_FAILED", raw: result.summary, traffic: mergeTraffic(probe.traffic, result.traffic), probe, result }));
        }
        return successResult(`已发起转发请求：${input.accountNickname}`, { probe, result, traffic: mergeTraffic(probe.traffic, result.traffic) });
      }

      return {
        success: true,
        status: "READY",
        stage: "PRECHECK_PASSED",
        message: `weibo executor 已接管 ${input.accountNickname} 的 ${input.planType} 计划，但该计划类型当前仍使用保守执行模式。`,
        responsePayload: { executor: "weibo", probe },
      };
    } catch (error) {
      return blockedResult(error instanceof Error ? error.message : "执行计划失败", withFailurePayload({ code: "PLAN_EXECUTION_EXCEPTION", reason: "PLAN_EXECUTION_EXCEPTION", raw: error instanceof Error ? error.message : "执行计划失败" }));
    }
  }

  async executeInteraction(input: ExecuteInteractionInput): Promise<ExecutorActionResult> {
    const blocked = validateInteractionPrecheck(input, "weibo");
    if (blocked) return blocked;

    try {
      const account = await getAccountCookie(input.accountId);
      const resolvedProxy = await resolveExecutionProxy(input.accountId, account.cookie);
      if (!resolvedProxy.selected || !resolvedProxy.probe?.ok) {
        return blockedResult("微博连通性探测未通过，无法进入真实执行阶段。", withFailurePayload({ executor: "weibo", code: "CONNECTIVITY_PROBE_FAILED", reason: "CONNECTIVITY_PROBE_FAILED", proxyAttempts: resolvedProxy.attempts }));
      }

      const proxyConfig = resolvedProxy.selected.proxyConfig;
      const probe = resolvedProxy.probe;

      if (input.actionType === "LIKE") {
        const warmup = await warmupInteractionTarget(input.targetUrl, account.cookie, proxyConfig);
        const commentId = tryExtractCommentId(input.targetUrl);
        const commentMode = Boolean(commentId) || isCommentLikeLink(input.targetUrl);
        const result = commentMode ? await sendCommentLikeRequest(input.targetUrl, account.cookie, proxyConfig) : await sendLikeRequest(input.targetUrl, account.cookie, proxyConfig);
        const businessOk = tryExtractBusinessOk(result.summary);
        const likeConfirmed = commentMode ? businessOk === true || isLikeConfirmed(result.summary) : isLikeConfirmed(result.summary);
        if (!result.ok || businessOk === false || !likeConfirmed) {
          return blockedResult(getLikeFailureMessage({ targetUrl: input.targetUrl, summary: result.summary, commentMode, loginStatus: account.loginStatus }), withFailurePayload({ code: commentMode ? "COMMENT_LIKE_REQUEST_FAILED" : "LIKE_REQUEST_FAILED", reason: commentMode ? "COMMENT_LIKE_REQUEST_FAILED" : "LIKE_REQUEST_FAILED", raw: result.summary, traffic: mergeTraffic(probe.traffic, warmup.traffic, result.traffic), probe, warmup, result }));
        }

        const resultStatusId = "statusId" in result ? result.statusId : undefined;
        const verifyResult = commentMode ? undefined : await verifyLikeState(account.cookie, input.targetUrl, [resultStatusId, extractLikeResultId(result.summary)], proxyConfig);
        return successResult(`已发起${commentMode ? "评论点赞" : "点赞"}请求：${input.accountNickname}`, { probe, warmup, result, verifyResult, verifyWarning: verifyResult && !verifyResult.ok ? "点赞请求已返回成功信号，但回查未确认，可能是微博回查接口限制导致。" : undefined, traffic: mergeTraffic(probe.traffic, warmup.traffic, result.traffic, verifyResult?.traffic) });
      }

      if (input.actionType === "POST" || input.actionType === "REPOST") {
        const result = await sendRepostRequest(input.targetUrl, account.cookie, input.repostContent, proxyConfig);
        const businessOk = tryExtractBusinessOk(result.summary);
        if (!result.ok || businessOk === false || !isPostConfirmed(result.summary)) {
          return blockedResult("转发请求未通过，请检查目标链接和账号登录态。", withFailurePayload({ code: "REPOST_REQUEST_FAILED", reason: "REPOST_REQUEST_FAILED", raw: result.summary, traffic: mergeTraffic(probe.traffic, result.traffic), probe, result }));
        }
        return successResult(`已发起转发请求：${input.accountNickname}`, { probe, result, traffic: mergeTraffic(probe.traffic, result.traffic) });
      }

      if (input.actionType === "COMMENT") {
        const statusId = normalizeStatusId(tryExtractStatusId(input.targetUrl));
        if (!statusId) {
          return blockedResult("未能从目标链接中解析出微博 ID，无法执行回复。", withFailurePayload({ code: "COMMENT_TARGET_PARSE_FAILED", reason: "COMMENT_TARGET_PARSE_FAILED", raw: input.targetUrl, probe, targetUrl: input.targetUrl }));
        }

        const commentsCount = await fetchStatusCommentsCount(statusId, account.cookie, input.targetUrl, proxyConfig);
        if (typeof commentsCount === "number" && commentsCount > 20) {
          return successResult("已大于20条", { probe, statusId, commentsCount, skipReason: "COMMENTS_GT_20" });
        }

        const result = await sendStatusComment(statusId, input.targetUrl, input.commentText || "", account.cookie, proxyConfig);
        if (!result.success) {
          return blockedResult("回复请求未通过，请检查目标链接、文案和账号登录态。", withFailurePayload({ code: "COMMENT_REQUEST_FAILED", reason: "COMMENT_REQUEST_FAILED", raw: result.payload, traffic: mergeTraffic(probe.traffic, result.traffic), probe, statusId, commentsCount, result }));
        }

        return successResult(`已发起回复请求：${input.accountNickname}`, { probe, statusId, commentsCount, commentText: input.commentText, result });
      }

      return {
        success: true,
        status: "READY",
        stage: "PRECHECK_PASSED",
        message: `weibo executor 已接管 ${input.accountNickname} 的 ${input.actionType} 互动任务，但该动作当前仍使用保守执行模式。`,
        responsePayload: { executor: "weibo", probe },
      };
    } catch (error) {
      return blockedResult(error instanceof Error ? error.message : "执行互动任务失败", withFailurePayload({ code: "INTERACTION_EXECUTION_EXCEPTION", reason: "INTERACTION_EXECUTION_EXCEPTION", raw: error instanceof Error ? error.message : "执行互动任务失败" }));
    }
  }
}

/**
 * 导出函数，供测试页面直接调用（绕过计划系统）
 */
export async function executeSinglePost(
  content: string,
  topicName: string,
  topicUrl: string,
  cookie: string,
  proxyConfig?: ProxyConfig | null,
): Promise<{ ok: boolean; message: string; attempts: unknown[]; traffic: unknown }> {
  const result = await sendPostRequest(content, topicName, topicUrl, undefined, cookie, proxyConfig);
  const latest = result.attempts[result.attempts.length - 1];
  const msg = result.ok
    ? "发帖成功"
    : `发帖失败：${typeof latest?.summary === "string" ? latest.summary : JSON.stringify(latest?.summary ?? "未知错误")}`;
  return { ok: result.ok, message: msg, attempts: result.attempts, traffic: result.traffic };
}
