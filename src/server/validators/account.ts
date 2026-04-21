import { z } from "zod";

const timeTextSchema = z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "时间格式应为 HH:MM");

export const createAccountSchema = z.object({
  nickname: z.string().min(1, "账号昵称不能为空").max(50, "账号昵称过长"),
  remark: z.string().max(100, "备注过长").optional().or(z.literal("")),
  groupName: z.string().max(50, "分组名称过长").optional().or(z.literal("")),
  status: z.enum(["ACTIVE", "DISABLED", "RISKY", "EXPIRED"]).default("ACTIVE"),
  scheduleWindowEnabled: z.boolean().optional().default(false),
  executionWindowStart: timeTextSchema.optional().or(z.literal("")),
  executionWindowEnd: timeTextSchema.optional().or(z.literal("")),
  baseJitterSec: z.number().int("随机间隔必须是整数").min(0, "随机间隔不能小于 0").max(3600, "随机间隔不能超过 3600 秒").optional().default(0),
}).superRefine((data, ctx) => {
  if (!data.scheduleWindowEnabled) {
    return;
  }

  if (!data.executionWindowStart) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["executionWindowStart"], message: "请输入执行窗口开始时间" });
  }

  if (!data.executionWindowEnd) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["executionWindowEnd"], message: "请输入执行窗口结束时间" });
  }

  if (data.executionWindowStart && data.executionWindowEnd && data.executionWindowStart >= data.executionWindowEnd) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["executionWindowEnd"], message: "第一版仅支持当天窗口，结束时间必须晚于开始时间" });
  }
});

export type CreateAccountInput = z.infer<typeof createAccountSchema>;
