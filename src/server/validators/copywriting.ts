import { z } from "zod";

export const createCopywritingSchema = z.object({
  title: z.string().min(1, "标题不能为空").max(100, "标题过长"),
  content: z.string().min(1, "文案内容不能为空").max(500, "文案内容过长"),
  tags: z.array(z.string().min(1).max(20)).default([]),
  status: z.enum(["ACTIVE", "DISABLED"]).default("ACTIVE"),
});
