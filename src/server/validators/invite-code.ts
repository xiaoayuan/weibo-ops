import { z } from "zod";

export const createInviteCodeSchema = z.object({
  role: z.enum(["VIEWER", "OPERATOR"]).default("VIEWER"),
  maxUses: z.number().int().min(1).max(100).default(1),
  expiresInHours: z.number().int().min(1).max(24 * 30).default(48),
});

export const updateInviteCodeSchema = z.object({
  disabled: z.boolean(),
});
