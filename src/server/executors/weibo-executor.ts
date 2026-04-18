import { decryptText } from "@/lib/encrypt";
import { prisma } from "@/lib/prisma";
import { sendHttpRequestWithRetry } from "@/server/executors/http-client";
import { validateInteractionPrecheck, validatePlanPrecheck } from "@/server/executors/precheck";
import type { ExecuteInteractionInput, ExecutePlanInput, ExecutorActionResult, SocialExecutor } from "@/server/executors/types";

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

  const patterns = [
    /[?&]mid=([a-zA-Z0-9]+)/i,
    /\/status\/([a-zA-Z0-9]+)/i,
    /\/detail\/([a-zA-Z0-9]+)/i,
  ];

  for (const pattern of patterns) {
    const matched = targetUrl.match(pattern);

    if (matched?.[1]) {
      return matched[1];
    }
  }

  return undefined;
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
  const statusId = tryExtractStatusId(targetUrl);

  if (!statusId) {
    return {
      ok: false,
      status: 0,
      summary: "目标链接中未识别到微博 ID",
      endpoint: "N/A",
      mode: "none",
      businessOk: false,
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
        body: form.toString(),
        timeoutMs: 12_000,
      },
      {
        retries: 1,
      },
    );

    const summary = response.json ?? response.text.slice(0, 220);
    const businessOk = tryExtractBusinessOk(summary);
    attempts.push({ endpoint, mode: "form-post", ok: response.ok, status: response.status, summary, businessOk });

    if (response.ok && businessOk !== false) {
      return {
        ok: true,
        status: response.status,
        summary,
        endpoint,
        mode: "form-post",
        businessOk,
        statusId,
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
    statusId,
    attempts,
  };
}

function tryExtractBusinessOk(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return undefined;
  }

  const record = payload as Record<string, unknown>;

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

      if (input.planType === "LIKE" && input.targetUrl) {
        const likeResult = await sendLikeRequest(input.targetUrl, account.cookie);
        const businessOk = tryExtractBusinessOk(likeResult.summary);

        if (!likeResult.ok || businessOk === false) {
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

        return successResult(`已发起点赞请求：${input.accountNickname}`, "SUCCESS", {
          executor: "weibo",
          action: "LIKE",
          summary: summarizePayload(likeResult.summary),
          planType: input.planType,
          targetUrl: input.targetUrl,
          loginStatus: account.loginStatus,
          probe,
          likeResult,
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
        const likeResult = await sendLikeRequest(input.targetUrl, account.cookie);
        const businessOk = tryExtractBusinessOk(likeResult.summary);

        if (!likeResult.ok || businessOk === false) {
          return blockedResult("点赞请求未通过，请检查目标链接和账号登录态。", {
            executor: "weibo",
            precheck: "blocked",
            reason: "LIKE_REQUEST_FAILED",
            summary: summarizePayload(likeResult.summary),
            actionType: input.actionType,
            targetUrl: input.targetUrl,
            loginStatus: account.loginStatus,
            probe,
            likeResult,
          });
        }

        return successResult(`已发起点赞请求：${input.accountNickname}`, "SUCCESS", {
          executor: "weibo",
          action: "LIKE",
          summary: summarizePayload(likeResult.summary),
          actionType: input.actionType,
          targetUrl: input.targetUrl,
          loginStatus: account.loginStatus,
          probe,
          likeResult,
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
