import { prisma } from "@/src/lib/prisma";

type BytesRow = {
  bytes: bigint | number | string;
};

type ActionBytesRow = {
  actionKey: string;
  logCount: number;
  bytes: bigint | number | string;
};

type DailyBytesRow = {
  day: string;
  bytes: bigint | number | string;
};

type RecentRow = {
  id: string;
  accountNickname: string;
  actionKey: string;
  executedAt: Date;
  bytes: bigint | number | string;
};

function trafficBytesSql() {
  return `
    COALESCE(
      CASE
        WHEN jsonb_typeof(l."responsePayload"::jsonb) = 'object'
          AND jsonb_typeof((l."responsePayload"::jsonb)->'traffic') = 'object'
          AND ((l."responsePayload"::jsonb)->'traffic'->>'totalBytes') ~ '^[0-9]+$'
        THEN ((l."responsePayload"::jsonb)->'traffic'->>'totalBytes')::bigint
        ELSE NULL
      END,
      (
        SELECT COALESCE(
          SUM(
            CASE
              WHEN jsonb_typeof(value) = 'number' THEN (value::text)::bigint
              WHEN jsonb_typeof(value) = 'string' AND trim(both '"' from value::text) ~ '^[0-9]+$'
                THEN trim(both '"' from value::text)::bigint
              ELSE 0
            END
          ),
          0
        )
        FROM jsonb_path_query(l."responsePayload"::jsonb, '$.**.traffic.totalBytes') AS value
      ),
      0
    )
  `;
}

function actionKeySql() {
  return `
    COALESCE(
      NULLIF(l."requestPayload"::jsonb->>'stepActionType', ''),
      NULLIF(l."requestPayload"::jsonb->>'actionType', ''),
      NULLIF(l."requestPayload"::jsonb->>'planType', ''),
      l."actionType"
    )
  `;
}

export async function getTrafficSummary(ownerUserId: string) {
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const bytesExpr = trafficBytesSql();
  const actionExpr = actionKeySql();

  const [oneDayRows, sevenDayRows, thirtyDayRows, actionRows, dailyRows, recentRows] = await Promise.all([
    prisma.$queryRawUnsafe<BytesRow[]>(
      `
        SELECT COALESCE(SUM(${bytesExpr}), 0)::bigint AS bytes
        FROM "ExecutionLog" l
        INNER JOIN "WeiboAccount" a ON a."id" = l."accountId"
        WHERE a."ownerUserId" = $1
          AND l."executedAt" >= $2
      `,
      ownerUserId,
      oneDayAgo,
    ),
    prisma.$queryRawUnsafe<BytesRow[]>(
      `
        SELECT COALESCE(SUM(${bytesExpr}), 0)::bigint AS bytes
        FROM "ExecutionLog" l
        INNER JOIN "WeiboAccount" a ON a."id" = l."accountId"
        WHERE a."ownerUserId" = $1
          AND l."executedAt" >= $2
      `,
      ownerUserId,
      sevenDaysAgo,
    ),
    prisma.$queryRawUnsafe<BytesRow[]>(
      `
        SELECT COALESCE(SUM(${bytesExpr}), 0)::bigint AS bytes
        FROM "ExecutionLog" l
        INNER JOIN "WeiboAccount" a ON a."id" = l."accountId"
        WHERE a."ownerUserId" = $1
          AND l."executedAt" >= $2
      `,
      ownerUserId,
      thirtyDaysAgo,
    ),
    prisma.$queryRawUnsafe<ActionBytesRow[]>(
      `
        SELECT
          ${actionExpr} AS "actionKey",
          COUNT(*)::int AS "logCount",
          COALESCE(SUM(${bytesExpr}), 0)::bigint AS bytes
        FROM "ExecutionLog" l
        INNER JOIN "WeiboAccount" a ON a."id" = l."accountId"
        WHERE a."ownerUserId" = $1
          AND l."executedAt" >= $2
        GROUP BY ${actionExpr}
        HAVING COALESCE(SUM(${bytesExpr}), 0) > 0
        ORDER BY bytes DESC
        LIMIT 12
      `,
      ownerUserId,
      sevenDaysAgo,
    ),
    prisma.$queryRawUnsafe<DailyBytesRow[]>(
      `
        SELECT
          to_char(l."executedAt", 'YYYY-MM-DD') AS day,
          COALESCE(SUM(${bytesExpr}), 0)::bigint AS bytes
        FROM "ExecutionLog" l
        INNER JOIN "WeiboAccount" a ON a."id" = l."accountId"
        WHERE a."ownerUserId" = $1
          AND l."executedAt" >= $2
        GROUP BY day
        ORDER BY day DESC
        LIMIT 14
      `,
      ownerUserId,
      fourteenDaysAgo,
    ),
    prisma.$queryRawUnsafe<RecentRow[]>(
      `
        SELECT
          l."id" AS id,
          a."nickname" AS "accountNickname",
          ${actionExpr} AS "actionKey",
          l."executedAt" AS "executedAt",
          ${bytesExpr} AS bytes
        FROM "ExecutionLog" l
        INNER JOIN "WeiboAccount" a ON a."id" = l."accountId"
        WHERE a."ownerUserId" = $1
          AND l."executedAt" >= $2
          AND ${bytesExpr} > 0
        ORDER BY l."executedAt" DESC
        LIMIT 30
      `,
      ownerUserId,
      sevenDaysAgo,
    ),
  ]);

  return {
    oneDayBytes: oneDayRows[0]?.bytes || 0,
    sevenDayBytes: sevenDayRows[0]?.bytes || 0,
    thirtyDayBytes: thirtyDayRows[0]?.bytes || 0,
    actionRows,
    dailyRows,
    recentRows,
  };
}
