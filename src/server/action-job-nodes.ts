import { prisma } from "@/lib/prisma";

const roundRobinKey = "action_job_node_round_robin_v1";
const heartbeatKeyPrefix = "action_job_node_heartbeat_v1_";

export type ActionJobNodeRole = "controller" | "worker";

export type ActionJobNodeOption = {
  id: string;
  label: string;
};

function parseNodeOption(raw: string): ActionJobNodeOption | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  const [id, label] = trimmed.split(":");
  const normalizedId = id?.trim();
  if (!normalizedId) {
    return null;
  }

  return {
    id: normalizedId,
    label: label?.trim() || normalizedId,
  };
}

export function getActionJobNodeRole(): ActionJobNodeRole {
  return process.env.NODE_ROLE === "worker" ? "worker" : "controller";
}

export function getCurrentNodeId() {
  return process.env.NODE_ID || "main-1";
}

export function getActionJobNodeOptions() {
  const configured = (process.env.ACTION_JOB_NODES || getCurrentNodeId())
    .split(",")
    .map(parseNodeOption)
    .filter((item): item is ActionJobNodeOption => Boolean(item));

  const unique = new Map(configured.map((item) => [item.id, item]));
  if (!unique.has(getCurrentNodeId())) {
    unique.set(getCurrentNodeId(), { id: getCurrentNodeId(), label: getCurrentNodeId() });
  }

  return Array.from(unique.values());
}

export async function writeNodeHeartbeat() {
  try {
    await prisma.systemSetting.upsert({
      where: { key: heartbeatKeyPrefix + getCurrentNodeId() },
      create: { key: heartbeatKeyPrefix + getCurrentNodeId(), value: { ts: Date.now() } as never },
      update: { value: { ts: Date.now() } as never },
    });
  } catch {
    // 心跳写入失败不要影响主流程
  }
}

async function getAliveNodeIds(): Promise<Set<string>> {
  const nodes = getActionJobNodeOptions();
  if (nodes.length === 1) return new Set([nodes[0].id]);

  const ttl = 120_000;
  const keys = nodes.map((n) => heartbeatKeyPrefix + n.id);

  try {
    const rows = await prisma.systemSetting.findMany({
      where: { key: { in: keys } },
      select: { key: true, value: true },
    });

    const now = Date.now();
    const alive = new Set<string>();

    for (const row of rows) {
      const nodeId = row.key.slice(heartbeatKeyPrefix.length);
      const ts = row.value && typeof row.value === "object" && !Array.isArray(row.value) ? (row.value as Record<string, unknown>).ts : null;
      if (typeof ts === "number" && now - ts < ttl) {
        alive.add(nodeId);
      }
    }

    // 当前节点自身总是算存活
    alive.add(getCurrentNodeId());

    return alive;
  } catch {
    return new Set(nodes.map((n) => n.id));
  }
}

export async function assignActionJobNode(preferredNodeId?: string | null) {
  const nodes = getActionJobNodeOptions();

  if (preferredNodeId) {
    const matched = nodes.find((item) => item.id === preferredNodeId);
    if (!matched) {
      throw new Error("指定的执行节点不存在");
    }
    return matched.id;
  }

  if (nodes.length === 1) {
    return nodes[0].id;
  }

  const aliveIds = await getAliveNodeIds();
  const aliveNodes = nodes.filter((n) => aliveIds.has(n.id));
  const activeNodes = aliveNodes.length > 0 ? aliveNodes : nodes;

  const setting = await prisma.systemSetting.findUnique({ where: { key: roundRobinKey }, select: { value: true } });
  const lastIndex =
    setting?.value && typeof setting.value === "object" && !Array.isArray(setting.value) && typeof (setting.value as Record<string, unknown>).index === "number"
      ? ((setting.value as Record<string, unknown>).index as number)
      : -1;
  const nextIndex = (lastIndex + 1) % activeNodes.length;

  await prisma.systemSetting.upsert({
    where: { key: roundRobinKey },
    create: { key: roundRobinKey, value: { index: nextIndex } as never },
    update: { value: { index: nextIndex } as never },
  });

  return activeNodes[nextIndex].id;
}
