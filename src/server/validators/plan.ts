import { z } from "zod";

export const generatePlansSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "日期格式不正确"),
});

export const updatePlanSchema = z.object({
  status: z.enum(["PENDING", "READY", "RUNNING", "SUCCESS", "FAILED", "CANCELLED"]).optional(),
  resultMessage: z.string().max(200, "结果说明过长").optional().or(z.literal("")),
  scheduledTime: z.string().datetime().optional(),
  contentId: z.string().optional().nullable(),
});
