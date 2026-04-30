import { prisma } from "@/src/lib/prisma";

const roundRobinKey = "action_job_node_round_robin_v1";

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

  const setting = await prisma.systemSetting.findUnique({ where: { key: roundRobinKey }, select: { value: true } });
  const lastIndex =
    setting?.value && typeof setting.value === "object" && !Array.isArray(setting.value) && typeof (setting.value as Record<string, unknown>).index === "number"
      ? ((setting.value as Record<string, unknown>).index as number)
      : -1;
  const nextIndex = (lastIndex + 1) % nodes.length;

  await prisma.systemSetting.upsert({
    where: { key: roundRobinKey },
    create: { key: roundRobinKey, value: { index: nextIndex } as never },
    update: { value: { index: nextIndex } as never },
  });

  return nodes[nextIndex].id;
}
