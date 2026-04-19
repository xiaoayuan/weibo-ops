import { z } from "zod";

export const parseInteractionTargetSchema = z.object({
  targetUrl: z.string().url("请填写有效链接"),
});

export const createInteractionBatchSchema = z.object({
  targetUrl: z.string().url("请填写有效链接"),
  accountIds: z.array(z.string().min(1)).min(1, "至少选择一个账号"),
  actionType: z.enum(["LIKE", "POST"]).default("LIKE"),
});
