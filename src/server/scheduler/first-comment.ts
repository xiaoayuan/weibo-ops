import { decryptText } from "@/lib/encrypt";
import { prisma } from "@/lib/prisma";
import { sendHttpRequestWithRetry } from "@/server/executors/http-client";
import { writeExecutionLog } from "@/server/logs";

const AUTO_FIRST_COMMENT_ENABLED = process.env.AUTO_FIRST_COMMENT_ENABLED !== "false";
const AUTO_FIRST_COMMENT_HOUR = Number(process.env.AUTO_FIRST_COMMENT_HOUR || 1);
const AUTO_FIRST_COMMENT_MINUTE = Number(process.env.AUTO_FIRST_COMMENT_MINUTE || 5);

declare global {
  var __firstCommentSchedulerStarted: boolean | undefined;
}

function formatDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toPlanDate(dateText: string) {
  return new Date(`${dateText}T00:00:00`);
}

function getNextRunAt(now: Date) {
  const next = new Date(now);
  next.setHours(AUTO_FIRST_COMMENT_HOUR, AUTO_FIRST_COMMENT_MINUTE, 0, 0);

  if (next.getTime() <= now.getTime()) {
    next.setDate(next.getDate() + 1);
  }

  return next;
}

function parseCookieMap(cookie: string) {
  return cookie
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean)
    .reduce<Record<string, string>>((acc, pair) => {
      const index = pair.indexOf("=");

      if (index <= 0) {
        return acc;
      }

      const key = pair.slice(0, index).trim();
      const value = pair.slice(index + 1).trim();

      if (!key) {
        return acc;
      }

      acc[key] = value;
      return acc;
    }, {});
}

function getXsrfToken(cookie: string) {
  const map = parseCookieMap(cookie);

  for (const key of ["XSRF-TOKEN", "XSRF_TOKEN", "XSRFToken", "_xsrf", "xsrf"]) {
    if (map[key]) {
      return decodeURIComponent(map[key]);
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
  commentsCount: number;
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

    if (idRaw && commentsCount !== undefined) {
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

async function fetchLatestPosts(topicUrl: string, cookie: string, limit: number) {
  const containerId = extractTopicContainerId(topicUrl);
  const endpoints = getTimelineEndpoints(topicUrl, containerId);
  const allPosts: CandidatePost[] = [];

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

async function sendFirstComment(statusId: string, targetUrl: string, commentText: string, cookie: string) {
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
  };
}

function randomTemplate(templates: string[]) {
  if (templates.length === 0) {
    return "";
  }

  const index = Math.floor(Math.random() * templates.length);
  return templates[index];
}

async function runAutoFirstCommentOnce() {
  const now = new Date();
  const dateText = formatDate(now);
  const planDate = toPlanDate(dateText);

  const tasks = await prisma.accountTopicTask.findMany({
    where: {
      status: true,
      firstCommentEnabled: true,
    },
    include: {
      account: {
        select: {
          id: true,
          nickname: true,
          cookieEncrypted: true,
        },
      },
      superTopic: {
        select: {
          id: true,
          name: true,
          topicUrl: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const topicIds = Array.from(new Set(tasks.map((task) => task.superTopicId)));
  const locks = await prisma.firstCommentPostLock.findMany({
    where: {
      planDate,
      superTopicId: {
        in: topicIds,
      },
    },
  });

  const usedMap = new Map<string, Set<string>>();

  for (const lock of locks) {
    const key = lock.superTopicId;

    if (!usedMap.has(key)) {
      usedMap.set(key, new Set());
    }

    usedMap.get(key)?.add(lock.statusId);
  }

  let total = 0;
  let success = 0;
  let failed = 0;

  for (const task of tasks) {
    const topicUrl = task.superTopic.topicUrl || "https://weibo.com/";
    const templates = task.firstCommentTemplates.map((item) => item.trim()).filter(Boolean);
    const taskPerDay = task.firstCommentPerDay || 4;

    if (!task.account.cookieEncrypted) {
      failed += taskPerDay;

      await writeExecutionLog({
        accountId: task.accountId,
        actionType: "FIRST_COMMENT_EXECUTE_FAILED",
        requestPayload: {
          taskId: task.id,
          superTopicId: task.superTopicId,
          planDate: dateText,
        },
        success: false,
        errorMessage: "账号未录入 Cookie",
      });

      continue;
    }

    if (templates.length === 0) {
      failed += taskPerDay;

      await writeExecutionLog({
        accountId: task.accountId,
        actionType: "FIRST_COMMENT_EXECUTE_FAILED",
        requestPayload: {
          taskId: task.id,
          superTopicId: task.superTopicId,
          planDate: dateText,
        },
        success: false,
        errorMessage: "首评文案池为空",
      });

      continue;
    }

    const cookie = decryptText(task.account.cookieEncrypted);
    const topicUsed = usedMap.get(task.superTopicId) || new Set<string>();
    usedMap.set(task.superTopicId, topicUsed);

    const latestPosts = await fetchLatestPosts(topicUrl, cookie, 100);

    for (let i = 0; i < taskPerDay; i += 1) {
      total += 1;
      const searchRange = i === 0 ? 20 : 100;
      const candidate = latestPosts
        .slice(0, searchRange)
        .find((post) => post.commentsCount === 0 && !topicUsed.has(post.id));

      if (!candidate) {
        failed += 1;

        await writeExecutionLog({
          accountId: task.accountId,
          actionType: "FIRST_COMMENT_EXECUTE_FAILED",
          requestPayload: {
            taskId: task.id,
            superTopicId: task.superTopicId,
            planDate: dateText,
            phase: "PICK_TARGET",
            searchRange,
          },
          success: false,
          errorMessage: "未找到可用的 0 回复帖子",
        });

        continue;
      }

      const commentText = randomTemplate(templates);
      const commentResult = await sendFirstComment(candidate.id, candidate.targetUrl || topicUrl, commentText, cookie);

      if (!commentResult.success) {
        failed += 1;

        await writeExecutionLog({
          accountId: task.accountId,
          actionType: "FIRST_COMMENT_EXECUTE_FAILED",
          requestPayload: {
            taskId: task.id,
            superTopicId: task.superTopicId,
            statusId: candidate.id,
            targetUrl: candidate.targetUrl,
            planDate: dateText,
            commentText,
          },
          responsePayload: commentResult.payload,
          success: false,
          errorMessage: `首评请求失败，HTTP ${commentResult.status}`,
        });

        continue;
      }

      try {
        await prisma.firstCommentPostLock.create({
          data: {
            planDate,
            superTopicId: task.superTopicId,
            statusId: candidate.id,
            accountId: task.accountId,
            taskId: task.id,
          },
        });

        topicUsed.add(candidate.id);
        success += 1;

        await writeExecutionLog({
          accountId: task.accountId,
          actionType: "FIRST_COMMENT_EXECUTE_SUCCESS",
          requestPayload: {
            taskId: task.id,
            superTopicId: task.superTopicId,
            statusId: candidate.id,
            targetUrl: candidate.targetUrl,
            planDate: dateText,
            commentText,
          },
          responsePayload: commentResult.payload,
          success: true,
        });
      } catch {
        failed += 1;

        await writeExecutionLog({
          accountId: task.accountId,
          actionType: "FIRST_COMMENT_EXECUTE_FAILED",
          requestPayload: {
            taskId: task.id,
            superTopicId: task.superTopicId,
            statusId: candidate.id,
            planDate: dateText,
          },
          responsePayload: commentResult.payload,
          success: false,
          errorMessage: "帖子锁定失败，可能与其他账号冲突",
        });
      }
    }
  }

  await writeExecutionLog({
    actionType: "AUTO_FIRST_COMMENT_DAILY_RUN",
    requestPayload: {
      date: dateText,
      hour: AUTO_FIRST_COMMENT_HOUR,
      minute: AUTO_FIRST_COMMENT_MINUTE,
    },
    responsePayload: {
      total,
      success,
      failed,
      taskCount: tasks.length,
    },
    success: failed === 0,
    errorMessage: failed > 0 ? `自动首评执行完成，失败 ${failed} 条` : undefined,
  });
}

function scheduleNext() {
  const now = new Date();
  const nextRunAt = getNextRunAt(now);
  const delay = nextRunAt.getTime() - now.getTime();

  setTimeout(async () => {
    try {
      await runAutoFirstCommentOnce();
    } catch (error) {
      await writeExecutionLog({
        actionType: "AUTO_FIRST_COMMENT_DAILY_RUN",
        requestPayload: {
          hour: AUTO_FIRST_COMMENT_HOUR,
          minute: AUTO_FIRST_COMMENT_MINUTE,
        },
        success: false,
        errorMessage: error instanceof Error ? error.message : "自动首评执行异常",
      });
    } finally {
      scheduleNext();
    }
  }, delay);
}

export function ensureFirstCommentSchedulerStarted() {
  if (!AUTO_FIRST_COMMENT_ENABLED) {
    return;
  }

  if (globalThis.__firstCommentSchedulerStarted) {
    return;
  }

  globalThis.__firstCommentSchedulerStarted = true;
  scheduleNext();
}
