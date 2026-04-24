import { z } from "zod";

export const assessCopywritingRiskSchema = z.object({
  businessType: z.string().min(1),
  context: z.string().max(2000).default(""),
  candidates: z.array(z.string().trim().min(1).max(500)).min(1).max(100),
});

export const assessTaskRiskSchema = z.object({
  taskType: z.string().min(1),
  urgency: z.enum(["S", "A", "B"]),
  accountCount: z.number().int().min(1).max(500),
  context: z.string().max(2000).optional(),
});

export const summarizeFailureRiskSchema = z.object({
  actionText: z.string().min(1).max(200),
  detailText: z.string().min(1).max(2000),
  topReason: z.string().max(1000).optional().nullable(),
});
