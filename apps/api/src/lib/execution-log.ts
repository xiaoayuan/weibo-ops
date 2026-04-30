import { prisma } from "@/src/lib/prisma";

type LogInput = {
  userId?: string;
  accountId?: string;
  planId?: string;
  actionType: string;
  requestPayload?: unknown;
  responsePayload?: unknown;
  success: boolean;
  errorMessage?: string;
};

export async function writeExecutionLog(input: LogInput) {
  try {
    await prisma.executionLog.create({
      data: {
        userId: input.userId,
        accountId: input.accountId,
        planId: input.planId,
        actionType: input.actionType,
        requestPayload: input.requestPayload as never,
        responsePayload: input.responsePayload as never,
        success: input.success,
        errorMessage: input.errorMessage,
      },
    });
  } catch {
    // 日志写入失败不阻断主流程
  }
}
