import { z } from "zod";

export const createUserSchema = z.object({
  username: z.string().min(1, "用户名不能为空").max(50, "用户名过长"),
  password: z.string().min(6, "密码至少 6 位").max(100, "密码过长"),
  role: z.enum(["ADMIN", "OPERATOR", "VIEWER"]),
});

export const updateUserSchema = z.object({
  password: z.string().min(6, "密码至少 6 位").max(100, "密码过长").optional().or(z.literal("")),
  role: z.enum(["ADMIN", "OPERATOR", "VIEWER"]).optional(),
});
