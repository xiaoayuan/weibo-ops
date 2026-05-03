import { getActionTypeText } from "@/lib/display-text";
import { requirePageRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

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

function toNumber(value: bigint | number | string | null | undefined) {
  if (value === null || value === undefined) {
    return 0;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === "bigint") {
    return Number(value);
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatBytes(bytes: number) {
  if (bytes <= 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let index = 0;

  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }

  const digits = value >= 100 ? 0 : value >= 10 ? 1 : 2;
  return `${value.toFixed(digits)} ${units[index]}`;
}

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

export default async function TrafficPage() {
  const session = await requirePageRole("VIEWER");
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
      session.id,
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
      session.id,
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
      session.id,
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
      session.id,
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
      session.id,
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
      session.id,
      sevenDaysAgo,
    ),
  ]);

  const oneDayBytes = toNumber(oneDayRows[0]?.bytes);
  const sevenDayBytes = toNumber(sevenDayRows[0]?.bytes);
  const thirtyDayBytes = toNumber(thirtyDayRows[0]?.bytes);
  const dailyTrend = [...dailyRows].reverse();

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold">流量监控</h2>
        <p className="mt-1 text-sm text-slate-500">按真实执行日志统计流量消耗，并按动作类型拆分来源。</p>
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">近24小时实际流量</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{formatBytes(oneDayBytes)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">近7天实际流量</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{formatBytes(sevenDayBytes)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">近30天实际流量</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{formatBytes(thirtyDayBytes)}</p>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-medium">动作流量占比（近7天）</h3>
          <div className="mt-4 space-y-3">
            {actionRows.length === 0 ? (
              <p className="text-sm text-slate-500">暂无流量数据</p>
            ) : (
              actionRows.map((item: ActionBytesRow) => (
                <div key={item.actionKey} className="flex items-center justify-between text-sm">
                  <div className="text-slate-700">{getActionTypeText(item.actionKey)}（{item.logCount} 次）</div>
                  <div className="font-medium text-slate-900">{formatBytes(toNumber(item.bytes))}</div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-medium">日趋势（近14天）</h3>
          <div className="mt-4 space-y-3">
            {dailyTrend.length === 0 ? (
              <p className="text-sm text-slate-500">暂无流量数据</p>
            ) : (
              dailyTrend.map((item: DailyBytesRow) => (
                <div key={item.day} className="flex items-center justify-between text-sm">
                  <div className="text-slate-600">{item.day}</div>
                  <div className="font-medium text-slate-900">{formatBytes(toNumber(item.bytes))}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-4">
          <h3 className="text-base font-medium">最近流量明细（近7天）</h3>
        </div>
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="px-6 py-3 font-medium">时间</th>
              <th className="px-6 py-3 font-medium">账号</th>
              <th className="px-6 py-3 font-medium">动作</th>
              <th className="px-6 py-3 font-medium">流量</th>
            </tr>
          </thead>
          <tbody>
            {recentRows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-slate-500">暂无流量明细</td>
              </tr>
            ) : (
              recentRows.map((item: RecentRow) => (
                <tr key={item.id} className="border-t border-slate-200">
                  <td className="px-6 py-4">{new Date(item.executedAt).toLocaleString("zh-CN")}</td>
                  <td className="px-6 py-4">{item.accountNickname}</td>
                  <td className="px-6 py-4">{getActionTypeText(item.actionKey)}</td>
                  <td className="px-6 py-4">{formatBytes(toNumber(item.bytes))}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
