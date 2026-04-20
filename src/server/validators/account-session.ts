import { z } from "zod";

export const saveAccountSessionSchema = z.object({
  uid: z.string().max(100, "UID 过长").optional().or(z.literal("")),
  username: z.string().max(100, "用户名过长").optional().or(z.literal("")),
  cookie: z.string().min(1, "Cookie 不能为空").max(10000, "Cookie 过长"),
});
