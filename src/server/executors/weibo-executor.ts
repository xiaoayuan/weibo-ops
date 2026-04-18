import { decryptText } from "@/lib/encrypt";
import { prisma } from "@/lib/prisma";
import { sendHttpRequestWithRetry } from "@/server/executors/http-client";
import { validateInteractionPrecheck, validatePlanPrecheck } from "@/server/executors/precheck";
import type { ExecuteInteractionInput, ExecutePlanInput, ExecutorActionResult, SocialExecutor } from "@/server/executors/types";

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
  const endpoint = process.env.WEIBO_CHECKIN_ENDPOINT || "https://weibo.com/ajax/super/starsign";
  const body = new URLSearchParams();

  if (input.topicName) {
    body.set("name", input.topicName);
  }

  if (input.topicUrl) {
    body.set("topic_url", input.topicUrl);
  }

  const response = await sendHttpRequestWithRetry({
    url: endpoint,
    method: "POST",
    headers: {
      Cookie: cookie,
      Referer: input.topicUrl || "https://weibo.com/",
      Origin: "https://weibo.com",
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "X-Requested-With": "XMLHttpRequest",
    },
    body: body.toString(),
    timeoutMs: 12_000,
  }, {
    retries: 1,
  });

  return {
    ok: response.ok,
    status: response.status,
    summary: response.json ?? response.text.slice(0, 200),
    endpoint,
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

        if (!checkInResult.ok || businessOk === false) {
          return blockedResult("签到请求未通过，请检查账号 Cookie 或超话参数。", {
            executor: "weibo",
            precheck: "blocked",
            reason: "CHECK_IN_REQUEST_FAILED",
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
          planType: input.planType,
          topicName: input.topicName,
          topicUrl: input.topicUrl,
          loginStatus: account.loginStatus,
          probe,
          checkInResult,
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
