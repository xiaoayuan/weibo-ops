import { prisma } from "@/src/lib/prisma";

export const accountSelect = {
  id: true,
  nickname: true,
  remark: true,
  groupName: true,
  status: true,
  loginStatus: true,
  riskLevel: true,
  uid: true,
  username: true,
  cookieUpdatedAt: true,
  lastCheckAt: true,
  loginErrorMessage: true,
  consecutiveFailures: true,
  scheduleWindowEnabled: true,
  executionWindowStart: true,
  executionWindowEnd: true,
  baseJitterSec: true,
  proxyNodeId: true,
  ownerUserId: true,
  createdAt: true,
  updatedAt: true,
  proxyNode: {
    select: {
      id: true,
      name: true,
      countryCode: true,
      rotationMode: true,
    },
  },
} as const;

export async function getVisibleAccountById(id: string) {
  return prisma.weiboAccount.findUnique({
    where: { id },
    select: accountSelect,
  });
}
