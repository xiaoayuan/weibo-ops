import { prisma } from "@/lib/prisma";

type LogInput = {
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
    // 日志写入失败不应阻断主流程
  }
}
