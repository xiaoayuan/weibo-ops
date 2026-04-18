import { decryptText } from "@/lib/encrypt";
import { prisma } from "@/lib/prisma";
import { sendHttpRequest } from "@/server/executors/http-client";
import { validateInteractionPrecheck, validatePlanPrecheck } from "@/server/executors/precheck";
import type { ExecuteInteractionInput, ExecutePlanInput, ExecutorActionResult, SocialExecutor } from "@/server/executors/types";

function notImplementedResult(message: string, responsePayload?: unknown): ExecutorActionResult {
  return {
    success: false,
    status: "FAILED",
    stage: "ACTION_PENDING",
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
  const response = await sendHttpRequest({
    url: "https://weibo.com/",
    headers: {
      Cookie: cookie,
      Referer: "https://weibo.com/",
    },
    timeoutMs: 10_000,
  });

  return {
    status: response.status,
    summary: response.json ?? response.text.slice(0, 200),
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

      return notImplementedResult(
        `weibo executor 骨架已就绪：账号 ${input.accountNickname} 的 ${input.planType} 计划通过了基础连通性探测，但尚未实现具体平台请求。`,
        {
          executor: "weibo",
          precheck: "passed",
          planType: input.planType,
          topicName: input.topicName,
          targetUrl: input.targetUrl,
          loginStatus: account.loginStatus,
          probe,
        },
      );
    } catch (error) {
      return notImplementedResult(error instanceof Error ? error.message : "执行计划失败");
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

      return notImplementedResult(
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
      return notImplementedResult(error instanceof Error ? error.message : "执行互动任务失败");
    }
  }
}
