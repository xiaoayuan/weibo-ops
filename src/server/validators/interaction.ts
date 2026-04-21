import { z } from "zod";

export const parseInteractionTargetSchema = z.object({
  targetUrl: z.string().url("请填写有效链接"),
});

export const createInteractionBatchSchema = z
  .object({
    targetUrl: z.string().url("请填写有效链接").optional(),
    targetUrls: z.array(z.string().url("请填写有效链接")).optional(),
    accountIds: z.array(z.string().min(1)).min(1, "至少选择一个账号"),
    contentIds: z.array(z.string().min(1)).optional(),
    actionType: z.enum(["LIKE", "POST", "COMMENT"]).default("LIKE"),
  })
  .superRefine((value, ctx) => {
    const targetCount = (value.targetUrls?.length || 0) + (value.targetUrl ? 1 : 0);

    if (targetCount === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["targetUrl"],
        message: "请至少提供一个目标链接",
      });
    }

    if (value.actionType === "COMMENT") {
      if (!value.targetUrls || value.targetUrls.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["targetUrls"],
          message: "回复任务请按行粘贴至少一个微博链接",
        });
      }

      if (!value.contentIds || value.contentIds.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["contentIds"],
          message: "回复任务至少选择一条文案",
        });
      }
    }
  });
