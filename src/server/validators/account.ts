import { z } from "zod";

export const createAccountSchema = z.object({
  nickname: z.string().min(1, "账号昵称不能为空").max(50, "账号昵称过长"),
  remark: z.string().max(100, "备注过长").optional().or(z.literal("")),
  groupName: z.string().max(50, "分组名称过长").optional().or(z.literal("")),
  status: z.enum(["ACTIVE", "DISABLED", "RISKY", "EXPIRED"]).default("ACTIVE"),
});

export type CreateAccountInput = z.infer<typeof createAccountSchema>;
