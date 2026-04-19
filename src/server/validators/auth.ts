import { z } from "zod";

export const loginSchema = z.object({
  username: z.string().min(1, "用户名不能为空").max(50, "用户名过长"),
  password: z.string().min(1, "密码不能为空").max(100, "密码过长"),
});

export const registerSchema = z.object({
  username: z.string().min(3, "用户名至少 3 位").max(50, "用户名过长"),
  password: z.string().min(6, "密码至少 6 位").max(100, "密码过长"),
  inviteCode: z.string().min(6, "注册码无效").max(64, "注册码无效"),
});
